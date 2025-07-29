import { validationResult } from "express-validator";
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
				message: "Validation failed",
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
						? "Email already registered"
						: "Username already taken",
			});
		}

		const user = new User({ name, email, username, password, role: userRole });
		await user.save();

		sendTokens(res, user, "User registered successfully", 201);
	} catch (error) {
		console.error("Registration error:", error);
		res
			.status(500)
			.json({ success: false, message: "Server error during registration" });
	}
};

// LOGIN
export const login = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				message: "Validation failed",
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
				.json({ success: false, message: "Invalid credentials" });
		}

		await user.updateLastActive();
		sendTokens(res, user, "Login successful", 200, true);
	} catch (error) {
		console.error("Login error:", error);
		res
			.status(500)
			.json({ success: false, message: "Server error during login" });
	}
};

// LOGOUT
export const logout = (req, res) => {
	res
		.clearCookie("token")
		.clearCookie("refreshToken")
		.status(200)
		.json({ success: true, message: "Logout successful" });
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
		res.status(500).json({ success: false, message: "Server error" });
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
				message: "Current password is incorrect",
			});
		}

		user.password = newPassword;
		await user.save();

		res.json({
			success: true,
			message: "Password changed successfully",
		});
	} catch (error) {
		console.error("Change password error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};
