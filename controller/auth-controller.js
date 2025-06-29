import { validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// JWT generator
const generateToken = (userId) => {
	return jwt.sign({ userId }, process.env.JWT_SECRET, {
		expiresIn: process.env.JWT_EXPIRE || "7d",
	});
};

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

		const { name, email, username, password } = req.body;

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

		const user = new User({ name, email, username, password });
		await user.save();

		const token = generateToken(user._id);
		const userResponse = user.toObject();
		delete userResponse.password;

		res.status(201).json({
			success: true,
			message: "User registered successfully",
			data: { user: userResponse, token },
		});
	} catch (error) {
		console.error("Registration error:", error);
		res
			.status(500)
			.json({ success: false, message: "Server error during registration" });
	}
};

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
			return res.status(401).json({
				success: false,
				message: "Invalid credentials",
			});
		}

		await user.updateLastActive();
		const token = generateToken(user._id);

		const userResponse = user.toObject();
		delete userResponse.password;

		res.json({
			success: true,
			message: "Login successful",
			data: { user: userResponse, token },
		});
	} catch (error) {
		console.error("Login error:", error);
		res
			.status(500)
			.json({ success: false, message: "Server error during login" });
	}
};

export const getMe = async (req, res) => {
	try {
		const user = await User.findById(req.user.id).populate(
			"achievements.achievementId",
			"title description icon rarity"
		);

		res.json({
			success: true,
			data: { user },
		});
	} catch (error) {
		console.error("Get user error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

export const logout = (req, res) => {
	res.json({
		success: true,
		message: "Logout successful",
	});
};

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
