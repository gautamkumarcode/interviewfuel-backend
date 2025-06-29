import { validationResult } from "express-validator";
import User from "../models/User.js";

// @desc    Get current user's profile
// @route   GET /api/users/profile
// @access  Private
export const getProfile = async (req, res) => {
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
		console.error("Get profile error:", error);
		res.status(500).json({
			success: false,
			message: "Server error",
		});
	}
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				message: "Validation failed",
				errors: errors.array(),
			});
		}

		const allowedUpdates = [
			"name",
			"bio",
			"location",
			"website",
			"social",
			"preferences",
		];
		const updates = {};

		Object.keys(req.body).forEach((key) => {
			if (allowedUpdates.includes(key)) {
				updates[key] = req.body[key];
			}
		});

		const user = await User.findByIdAndUpdate(
			req.user.id,
			{ $set: updates },
			{ new: true, runValidators: true }
		);

		res.json({
			success: true,
			message: "Profile updated successfully",
			data: { user },
		});
	} catch (error) {
		console.error("Update profile error:", error);
		res.status(500).json({
			success: false,
			message: "Server error",
		});
	}
};
