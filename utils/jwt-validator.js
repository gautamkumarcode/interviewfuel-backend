import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

/**
 * @param {string} token - The JWT token to validate
 * @returns {Object} - Validation result with decoded data or error
 */
export const validateToken = (token) => {
	try {
		if (!token) {
			return {
				isValid: false,
				error: "No token provided",
			};
		}

		if (!process.env.JWT_SECRET) {
			return {
				isValid: false,
				error: "JWT_SECRET not configured",
			};
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET);

		return {
			isValid: true,
			decoded,
			userId: decoded.id,
		};
	} catch (error) {
		return {
			isValid: false,
			error: error.message,
			errorType: error.name,
		};
	}
};

/**
 * Generate a new JWT token
 * @param {string} userId - User ID to encode in token
 * @returns {string} - Generated JWT token
 */
export const generateToken = (userId) => {
	if (!process.env.JWT_SECRET) {
		throw new Error("JWT_SECRET not configured");
	}

	return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
		expiresIn: process.env.JWT_EXPIRE || "7d",
	});
};

/**
 * Check if a token is expired
 * @param {string} token - The JWT token to check
 * @returns {boolean} - True if token is expired
 */
export const isTokenExpired = (token) => {
	try {
		const decoded = jwt.decode(token);
		if (!decoded || !decoded.exp) {
			return true;
		}

		const currentTime = Math.floor(Date.now() / 1000);
		return decoded.exp < currentTime;
	} catch (error) {
		return true;
	}
};
