import { validationResult } from "express-validator";
import { ERROR_MESSAGES } from "../const/error-message.js";
import { SUCCESS_MESSAGE } from "../const/succes-message.js";
import User from "../models/User.js";
import {
	generateAccessToken,
	generateRefreshToken,
} from "../services/jwt-token-services.js";
import { generateUsernameFromEmail } from "../utils/username-generator.js";

const sendTokens = (res, user, message, statusCode = 200, minimal = false) => {
	const accessToken = generateAccessToken(user._id);
	const refreshToken = generateRefreshToken(user._id);

	const userResponse = user.toObject();
	delete userResponse.password;

	res
		.status(statusCode)
		.cookie("token", accessToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "Lax",
			path: "/",
			maxAge: 1 * 60 * 1000, // 15 mins
		})
		.cookie("refreshToken", refreshToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "Lax",
			path: "/",
			maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
		})
		.json({
			success: true,
			message,
			data: minimal
				? {
						user: {
							id: user._id,
							name: user.name,
							role: user.role,
						},
						token: accessToken,
						refreshToken,
				  }
				: {
						user: userResponse,
				  },
		});
};

// REGISTER
export const register = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				message: ERROR_MESSAGES.VALIDATION_FAILED,
				errors: errors.array(),
			});
		}

		const { name, email, username, password, userRole } = req.body;

		// Generate unique username if not provided
		const finalUsername = username || (await generateUsernameFromEmail(email));

		const existingUser = await User.findOne({
			$or: [{ email }, { userName: finalUsername }],
		});

		if (existingUser) {
			return res.status(400).json({
				success: false,
				message:
					existingUser.email === email
						? ERROR_MESSAGES.EMAIL_ALREADY_EXISTS
						: ERROR_MESSAGES.USERNAME_ALREADY_EXISTS,
			});
		}

		const user = new User({
			name,
			email,
			userName: finalUsername,
			password,
			role: userRole,
		});
		await user.save();

		sendTokens(res, user, SUCCESS_MESSAGE.USER_REGISTERED, 201);
	} catch (error) {
		console.error("Registration error:", error);

		// Handle duplicate key error specifically
		if (error.code === 11000) {
			const field = Object.keys(error.keyPattern)[0];
			const fieldName = field === "userName" ? "username" : field;
			return res.status(409).json({
				success: false,
				message: `This ${fieldName} is already taken. Please try a different one.`,
			});
		}

		res
			.status(500)
			.json({ success: false, message: ERROR_MESSAGES.SERVER_ERROR });
	}
};

// LOGIN
export const login = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				message: ERROR_MESSAGES.VALIDATION_FAILED,
				errors: errors.array(),
			});
		}

		const { email, password } = req.body;

		const user = await User.findOne({
			$or: [{ email: email.toLowerCase() }, { username: email }],
		}).select("+password");

		if (!user || !(await user.comparePassword(password))) {
			return res
				.status(401)
				.json({ success: false, message: ERROR_MESSAGES.INVALID_CREDENTIALS });
		}

		await user.updateLastActive();
		sendTokens(res, user, SUCCESS_MESSAGE.USER_LOGGED_IN, 200, true);
	} catch (error) {
		console.error("Login error:", error);
		res
			.status(500)
			.json({ success: false, message: ERROR_MESSAGES.SERVER_ERROR });
	}
};

// LOGOUT
export const logout = (req, res) => {
	res
		.clearCookie("token")
		.clearCookie("refreshToken")
		.status(200)
		.json({ success: true, message: SUCCESS_MESSAGE.USER_LOGGED_OUT });
};

// GET PROFILE
export const getMe = async (req, res) => {
	try {
		const user = await User.findById(req.user.id)
			.select("-password")
			.populate("achievements.achievementId", "title description icon rarity");

		res.json({
			success: true,
			data: { user },
		});
	} catch (error) {
		console.error("Get user error:", error);
		res
			.status(500)
			.json({ success: false, message: ERROR_MESSAGES.SERVER_ERROR });
	}
};

// CHANGE PASSWORD
export const changePassword = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				message: "Validation failed",
				errors: errors.array(),
			});
		}

		const { currentPassword, newPassword } = req.body;
		const user = await User.findById(req.user.id).select("+password");

		if (!user || !(await user.comparePassword(currentPassword))) {
			return res.status(400).json({
				success: false,
				message: ERROR_MESSAGES.PASSWORD_MISMATCH,
			});
		}

		user.password = newPassword;
		await user.save();

		res.json({
			success: true,
			message: SUCCESS_MESSAGE.USER_PASSWORD_CHANGED,
		});
	} catch (error) {
		console.error("Change password error:", error);
		res.status(500).json({ success: false, message: ERROR_MESSAGES.SERVER_ERROR });
	}
};

// UPDATE PROFILE
export const updateProfile = async (req, res) => {
	try {
		const { name, userName, bio, location, website, social } = req.body;
		const userId = req.user.id;

		// Check if username is being changed and if it's already taken
		if (userName) {
			const existingUser = await User.findOne({
				userName,
				_id: { $ne: userId },
			});

			if (existingUser) {
				return res.status(400).json({
					success: false,
					message: "Username is already taken",
				});
			}
		}

		const updateData = {};
		if (name !== undefined) updateData.name = name;
		if (userName !== undefined) updateData.userName = userName;
		if (bio !== undefined) updateData.bio = bio;
		if (location !== undefined) updateData.location = location;
		if (website !== undefined) updateData.website = website;
		if (social !== undefined) updateData.social = social;

		const user = await User.findByIdAndUpdate(userId, updateData, {
			new: true,
			runValidators: true,
		}).select("-password");

		res.json({
			success: true,
			message: "Profile updated successfully",
			data: { user },
		});
	} catch (error) {
		console.error("Update profile error:", error);
		res.status(500).json({
			success: false,
			message: ERROR_MESSAGES.SERVER_ERROR,
		});
	}
};

// UPLOAD AVATAR
export const uploadAvatar = async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({
				success: false,
				message: "No file uploaded",
			});
		}

		const userId = req.user.id;
		const user = await User.findById(userId);

		// Delete old avatar if exists
		if (user.avatar) {
			try {
				const { deleteAvatar: deleteAvatarFromStorage } = await import(
					"../services/storage-service.js"
				);
				await deleteAvatarFromStorage(user.avatar);
			} catch (deleteError) {
				console.error("Error deleting old avatar:", deleteError);
				// Continue even if deletion fails
			}
		}

		// Upload new avatar using storage service
		const { uploadAvatar: uploadAvatarToStorage } = await import(
			"../services/storage-service.js"
		);
		const avatarUrl = await uploadAvatarToStorage(req.file.buffer, userId);

		// Update user avatar URL
		user.avatar = avatarUrl;
		await user.save();

		res.json({
			success: true,
			message: "Avatar uploaded successfully",
			data: { avatarUrl },
		});
	} catch (error) {
		console.error("Upload avatar error:", error);
		res.status(500).json({
			success: false,
			message: error.message || ERROR_MESSAGES.SERVER_ERROR,
		});
	}
};

// DELETE AVATAR
export const deleteAvatar = async (req, res) => {
	try {
		const userId = req.user.id;
		const user = await User.findById(userId);

		// Delete from storage if exists
		if (user.avatar) {
			try {
				const { deleteAvatar: deleteAvatarFromStorage } = await import(
					"../services/storage-service.js"
				);
				await deleteAvatarFromStorage(user.avatar);
			} catch (deleteError) {
				console.error("Error deleting from storage:", deleteError);
				// Continue even if deletion fails
			}
		}

		// Update user avatar to null
		await User.findByIdAndUpdate(userId, { avatar: null });

		res.json({
			success: true,
			message: "Avatar deleted successfully",
		});
	} catch (error) {
		console.error("Delete avatar error:", error);
		res.status(500).json({
			success: false,
			message: ERROR_MESSAGES.SERVER_ERROR,
		});
	}
};

// UPDATE PREFERENCES
export const updatePreferences = async (req, res) => {
	try {
		const { preferences } = req.body;
		const userId = req.user.id;

		const user = await User.findByIdAndUpdate(
			userId,
			{ preferences },
			{ new: true, runValidators: true }
		).select("-password");

		res.json({
			success: true,
			message: "Preferences updated successfully",
			data: { user },
		});
	} catch (error) {
		console.error("Update preferences error:", error);
		res.status(500).json({
			success: false,
			message: ERROR_MESSAGES.SERVER_ERROR,
		});
	}
};

// EXPORT USER DATA
export const exportUserData = async (req, res) => {
	try {
		const userId = req.user.id;

		const user = await User.findById(userId)
			.select("-password")
			.populate("achievements.achievementId");

		const exportData = {
			profile: {
				name: user.name,
				email: user.email,
				userName: user.userName,
				bio: user.bio,
				location: user.location,
				website: user.website,
				social: user.social,
				joinDate: user.createdAt,
			},
			stats: user.stats,
			achievements: user.achievements,
			preferences: user.preferences,
			exportedAt: new Date().toISOString(),
		};

		res.setHeader("Content-Type", "application/json");
		res.setHeader(
			"Content-Disposition",
			`attachment; filename="user-data-${user.userName}-${Date.now()}.json"`
		);
		res.json(exportData);
	} catch (error) {
		console.error("Export data error:", error);
		res.status(500).json({
			success: false,
			message: ERROR_MESSAGES.SERVER_ERROR,
		});
	}
};

// DELETE ACCOUNT
export const deleteAccount = async (req, res) => {
	try {
		const { password } = req.body;
		const userId = req.user.id;

		if (!password) {
			return res.status(400).json({
				success: false,
				message: "Password is required to delete account",
			});
		}

		const user = await User.findById(userId).select("+password");

		if (!user || !(await user.comparePassword(password))) {
			return res.status(401).json({
				success: false,
				message: "Invalid password",
			});
		}

		// Soft delete - mark as inactive instead of actually deleting
		await User.findByIdAndUpdate(userId, { isActive: false });

		// Clear cookies
		res.clearCookie("token").clearCookie("refreshToken");

		res.json({
			success: true,
			message: "Account deleted successfully",
		});
	} catch (error) {
		console.error("Delete account error:", error);
		res.status(500).json({
			success: false,
			message: ERROR_MESSAGES.SERVER_ERROR,
		});
	}
};
