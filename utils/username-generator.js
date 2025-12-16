import crypto from "crypto";
import User from "../models/User.js";

/**
 * Generate a unique username related to InterviewFuel
 * @param {string} baseName - Base name to generate username from (e.g., email prefix or user name)
 * @param {number} maxAttempts - Maximum number of attempts to generate unique username
 * @returns {Promise<string>} Unique username
 */
export const generateUniqueUsername = async (
	baseName = "",
	maxAttempts = 10
) => {
	// Clean the base name - remove special characters and spaces
	const cleanBaseName = baseName
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "")
		.substring(0, 10);

	// InterviewFuel themed prefixes for variety
	const prefixes = [
		"ifuel",
		"fuel",
		"coder",
		"dev",
		"ace",
		"pro",
		"tech",
		"guru",
	];

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		let username;

		if (attempt === 0 && cleanBaseName) {
			// First attempt: try the clean base name with a suffix
			const randomNum = Math.floor(Math.random() * 9999);
			username = `${cleanBaseName}${randomNum}`;
		} else if (attempt === 1 && cleanBaseName) {
			// Second attempt: prefix + base name
			const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
			const randomNum = Math.floor(Math.random() * 999);
			username = `${prefix}${cleanBaseName}${randomNum}`;
		} else {
			// Subsequent attempts: use InterviewFuel themed usernames
			const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
			const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
			const randomStr = crypto.randomBytes(2).toString("hex"); // 4 random characters
			username = `${prefix}${timestamp}${randomStr}`;
		}

		// Ensure username meets length requirements (3-20 characters)
		if (username.length < 3) {
			username = username + crypto.randomBytes(2).toString("hex");
		}
		if (username.length > 20) {
			username = username.substring(0, 20);
		}

		// Check if username exists
		const existingUser = await User.findOne({ userName: username });
		if (!existingUser) {
			return username;
		}
	}

	// Fallback: generate a completely random username
	const fallbackPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
	const uniqueId = crypto.randomBytes(4).toString("hex"); // 8 random characters
	return `${fallbackPrefix}${uniqueId}`;
};

/**
 * Generate username from email
 * @param {string} email - User's email address
 * @returns {Promise<string>} Unique username
 */
export const generateUsernameFromEmail = async (email) => {
	const baseName = email.split("@")[0];
	return generateUniqueUsername(baseName);
};

/**
 * Generate username from name
 * @param {string} name - User's full name
 * @returns {Promise<string>} Unique username
 */
export const generateUsernameFromName = async (name) => {
	// Take first part of name (first name)
	const baseName = name.split(" ")[0];
	return generateUniqueUsername(baseName);
};
