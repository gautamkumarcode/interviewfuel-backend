import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import sharp from "sharp";

// Storage provider type from environment variable
const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || "cloudinary"; // 'cloudinary' or 's3'

/**
 * Upload avatar to configured storage provider
 * @param {Buffer} fileBuffer - Image file buffer
 * @param {string} userId - User ID for unique filename
 * @returns {Promise<string>} - Public URL of uploaded image
 */
export const uploadAvatar = async (fileBuffer, userId) => {
	if (STORAGE_PROVIDER === "s3") {
		return uploadToS3(fileBuffer, userId);
	} else {
		return uploadToCloudinary(fileBuffer, userId);
	}
};

/**
 * Delete avatar from configured storage provider
 * @param {string} avatarUrl - URL of the avatar to delete
 * @returns {Promise<void>}
 */
export const deleteAvatar = async (avatarUrl) => {
	if (STORAGE_PROVIDER === "s3") {
		return deleteFromS3(avatarUrl);
	} else {
		return deleteFromCloudinary(avatarUrl);
	}
};

// ==================== S3 Implementation ====================

async function uploadToS3(fileBuffer, userId) {
	const s3Client = (await import("../config/s3.js")).default;

	// Process image with sharp (resize, optimize)
	const processedImage = await sharp(fileBuffer)
		.resize(400, 400, {
			fit: "cover",
			position: "attention", // Smart crop focusing on interesting areas
		})
		.jpeg({ quality: 85 })
		.toBuffer();

	const fileName = `avatars/${userId}-${Date.now()}.jpg`;
	const bucketName = process.env.AWS_S3_BUCKET_NAME;

	// Upload to S3
	const upload = new Upload({
		client: s3Client,
		params: {
			Bucket: bucketName,
			Key: fileName,
			Body: processedImage,
			ContentType: "image/jpeg",
			ACL: "public-read", // Make publicly accessible
		},
	});

	await upload.done();

	// Return public URL
	const region = process.env.AWS_REGION || "us-east-1";
	return `https://${bucketName}.s3.${region}.amazonaws.com/${fileName}`;
}

async function deleteFromS3(avatarUrl) {
	if (!avatarUrl) return;

	try {
		const s3Client = (await import("../config/s3.js")).default;

		// Extract key from URL
		// URL format: https://bucket-name.s3.region.amazonaws.com/avatars/filename.jpg
		const urlParts = new URL(avatarUrl);
		const key = urlParts.pathname.substring(1); // Remove leading slash

		const bucketName = process.env.AWS_S3_BUCKET_NAME;

		const command = new DeleteObjectCommand({
			Bucket: bucketName,
			Key: key,
		});

		await s3Client.send(command);
	} catch (error) {
		console.error("Error deleting from S3:", error);
		throw error;
	}
}

// ==================== Cloudinary Implementation ====================

async function uploadToCloudinary(fileBuffer, userId) {
	const cloudinary = (await import("../config/cloudinary.js")).default;

	return new Promise((resolve, reject) => {
		const uploadStream = cloudinary.uploader.upload_stream(
			{
				folder: "avatars",
				public_id: `${userId}-${Date.now()}`,
				transformation: [
					{ width: 400, height: 400, crop: "fill", gravity: "face" },
					{ quality: "auto" },
					{ fetch_format: "auto" },
				],
			},
			(error, result) => {
				if (error) reject(error);
				else resolve(result.secure_url);
			}
		);

		uploadStream.end(fileBuffer);
	});
}

async function deleteFromCloudinary(avatarUrl) {
	if (!avatarUrl) return;

	try {
		const cloudinary = (await import("../config/cloudinary.js")).default;

		// Extract public_id from Cloudinary URL
		const urlParts = avatarUrl.split("/");
		const publicIdWithExt = urlParts[urlParts.length - 1];
		const publicId = publicIdWithExt.split(".")[0];
		const folder = urlParts[urlParts.length - 2];
		const fullPublicId = `${folder}/${publicId}`;

		await cloudinary.uploader.destroy(fullPublicId);
	} catch (error) {
		console.error("Error deleting from Cloudinary:", error);
		throw error;
	}
}

// Export storage provider info
export const getStorageProvider = () => STORAGE_PROVIDER;
