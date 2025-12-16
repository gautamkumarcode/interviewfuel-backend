import { ERROR_MESSAGES } from "../const/error-message.js";
import { SUCCESS_MESSAGE } from "../const/succes-message.js";
import User from "../models/User.js";
import {
	generateAccessToken,
	generateRefreshToken,
} from "../services/jwt-token-services.js";
import { generateUsernameFromEmail } from "../utils/username-generator.js";

const sendTokens = (res, user, message, statusCode = 200) => {
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
			data: {
				user: {
					id: user._id,
					name: user.name,
					email: user.email,
					role: user.role,
				},
				token: accessToken,
				refreshToken,
			},
		});
};

// OAuth Login/Register
export const oauthLogin = async (req, res) => {
	try {
		const { email, name, oauthProvider, oauthId, avatar } = req.body;

		if (!email || !name || !oauthProvider || !oauthId) {
			return res.status(400).json({
				success: false,
				message: "Missing required OAuth fields",
			});
		}

		// Check if user exists with this OAuth provider
		let user = await User.findOne({ oauthProvider, oauthId });

		if (!user) {
			// Check if user exists with this email
			user = await User.findOne({ email });

			if (user) {
				// User exists with email but different auth method
				// Link OAuth account to existing user
				user.oauthProvider = oauthProvider;
				user.oauthId = oauthId;
				if (avatar && !user.avatar) {
					user.avatar = avatar;
				}
				await user.save();
			} else {
				// Create new user with unique InterviewFuel themed username
				const username = await generateUsernameFromEmail(email);
				user = new User({
					name,
					email,
					userName: username,
					oauthProvider,
					oauthId,
					avatar: avatar || null,
					// No password needed for OAuth users
				});
				await user.save();
			}
		} else {
			// Update last active
			await user.updateLastActive();

			// Update avatar if provided and user doesn't have one
			if (avatar && !user.avatar) {
				user.avatar = avatar;
				await user.save();
			}
		}

		sendTokens(res, user, SUCCESS_MESSAGE.USER_LOGGED_IN, 200);
	} catch (error) {
		console.error("OAuth login error:", error);

		// Handle duplicate key error specifically
		if (error.code === 11000) {
			const field = Object.keys(error.keyPattern)[0];
			return res.status(409).json({
				success: false,
				message: `A user with this ${field} already exists. Please try again.`,
			});
		}

		res.status(500).json({
			success: false,
			message: ERROR_MESSAGES.SERVER_ERROR,
		});
	}
};
