import { validationResult } from "express-validator";
import { ERROR_MESSAGES } from "../const/error-message.js";
import { SUCCESS_MESSAGE } from "../const/succes-message.js";
import User from "../models/User.js";
import {
	generateAccessToken,
	generateRefreshToken,
} from "../services/jwt-token-services.js";

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

		const existingUser = await User.findOne({
			$or: [{ email }, { username }],
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

		const user = new User({ name, email, username, password, role: userRole });
		await user.save();

		sendTokens(res, user, SUCCESS_MESSAGE.USER_REGISTERED, 201);
	} catch (error) {
		console.error("Registration error:", error);
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
