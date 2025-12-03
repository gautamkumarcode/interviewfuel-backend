import bcrypt from "bcryptjs";
import { validationResult } from "express-validator";
import { ERROR_MESSAGES } from "../const/error-message.js";
import { SUCCESS_MESSAGE } from "../const/succes-message.js";
import User from "../models/User.js";

// @desc    Get all users with pagination and filters
// @route   GET /api/admin/users
// @access  Private/Admin
export const getAllUsers = async (req, res) => {
	try {
		const {
			page = 1,
			limit = 10,
			search = "",
			role = "",
			status = "",
			sortBy = "createdAt",
			order = "desc",
		} = req.query;

		// Build query
		const query = {};

		// Search by name, email, or username
		if (search) {
			query.$or = [
				{ name: { $regex: search, $options: "i" } },
				{ email: { $regex: search, $options: "i" } },
				{ userName: { $regex: search, $options: "i" } },
			];
		}

		// Filter by role
		if (role) {
			query.role = role;
		}

		// Filter by account status
		if (status === "active") {
			query.isActive = true;
		} else if (status === "inactive") {
			query.isActive = false;
		}

		// Calculate pagination
		const skip = (parseInt(page) - 1) * parseInt(limit);

		// Sort options
		const sortOptions = {};
		sortOptions[sortBy] = order === "asc" ? 1 : -1;

		// Execute query
		const users = await User.find(query)
			.select("-password -refreshToken")
			.sort(sortOptions)
			.limit(parseInt(limit))
			.skip(skip)
			.lean();

		// Get total count
		const total = await User.countDocuments(query);

		res.json({
			success: true,
			data: {
				users,
				pagination: {
					page: parseInt(page),
					limit: parseInt(limit),
					total,
					pages: Math.ceil(total / parseInt(limit)),
				},
			},
		});
	} catch (error) {
		console.error("Get all users error:", error);
		res.status(500).json({
			success: false,
			message: ERROR_MESSAGES.SERVER_ERROR,
		});
	}
};

// @desc    Get user by ID
// @route   GET /api/admin/users/:id
// @access  Private/Admin
export const getUserById = async (req, res) => {
	try {
		const user = await User.findById(req.params.id)
			.select("-password -refreshToken")
			.populate("achievements.achievementId", "title description icon")
			.lean();

		if (!user) {
			return res.status(404).json({
				success: false,
				message: ERROR_MESSAGES.USER_NOT_FOUND,
			});
		}

		res.json({
			success: true,
			data: { user },
		});
	} catch (error) {
		console.error("Get user by ID error:", error);
		res.status(500).json({
			success: false,
			message: ERROR_MESSAGES.SERVER_ERROR,
		});
	}
};

// @desc    Create new user
// @route   POST /api/admin/users
// @access  Private/Admin
export const createUser = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				message: ERROR_MESSAGES.VALIDATION_FAILED,
				errors: errors.array(),
			});
		}

		const { name, email, userName, password, role, bio } = req.body;

		// Check if user already exists
		const existingUser = await User.findOne({
			$or: [{ email }, { userName }],
		});

		if (existingUser) {
			return res.status(400).json({
				success: false,
				message:
					existingUser.email === email
						? ERROR_MESSAGES.EMAIL_EXISTS
						: ERROR_MESSAGES.USERNAME_EXISTS,
			});
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(password, 12);

		// Create user
		const user = await User.create({
			name,
			email,
			userName,
			password: hashedPassword,
			role: role || "user",
			bio: bio || "",
		});

		// Remove password from response
		const userResponse = user.toObject();
		delete userResponse.password;
		delete userResponse.refreshToken;

		res.status(201).json({
			success: true,
			message: SUCCESS_MESSAGE.USER_CREATED,
			data: { user: userResponse },
		});
	} catch (error) {
		console.error("Create user error:", error);
		res.status(500).json({
			success: false,
			message: ERROR_MESSAGES.SERVER_ERROR,
		});
	}
};

// @desc    Update user
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
export const updateUser = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				message: ERROR_MESSAGES.VALIDATION_FAILED,
				errors: errors.array(),
			});
		}

		const user = await User.findById(req.params.id);

		if (!user) {
			return res.status(404).json({
				success: false,
				message: ERROR_MESSAGES.USER_NOT_FOUND,
			});
		}

		// Prevent admin from demoting themselves
		if (
			req.params.id === req.user.id &&
			req.body.role &&
			req.body.role !== "admin"
		) {
			return res.status(400).json({
				success: false,
				message: "You cannot change your own role",
			});
		}

		// Allowed fields to update
		const allowedUpdates = [
			"name",
			"email",
			"userName",
			"role",
			"bio",
			"location",
			"website",
			"isActive",
		];

		const updates = {};
		Object.keys(req.body).forEach((key) => {
			if (allowedUpdates.includes(key)) {
				updates[key] = req.body[key];
			}
		});

		// Check if email or username is being changed and already exists
		if (updates.email && updates.email !== user.email) {
			const emailExists = await User.findOne({ email: updates.email });
			if (emailExists) {
				return res.status(400).json({
					success: false,
					message: ERROR_MESSAGES.EMAIL_EXISTS,
				});
			}
		}

		if (updates.userName && updates.userName !== user.userName) {
			const usernameExists = await User.findOne({ userName: updates.userName });
			if (usernameExists) {
				return res.status(400).json({
					success: false,
					message: ERROR_MESSAGES.USERNAME_EXISTS,
				});
			}
		}

		// Update user
		Object.assign(user, updates);
		await user.save();

		// Remove sensitive data
		const userResponse = user.toObject();
		delete userResponse.password;
		delete userResponse.refreshToken;

		res.json({
			success: true,
			message: SUCCESS_MESSAGE.USER_UPDATED,
			data: { user: userResponse },
		});
	} catch (error) {
		console.error("Update user error:", error);
		res.status(500).json({
			success: false,
			message: ERROR_MESSAGES.SERVER_ERROR,
		});
	}
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res) => {
	try {
		const user = await User.findById(req.params.id);

		if (!user) {
			return res.status(404).json({
				success: false,
				message: ERROR_MESSAGES.USER_NOT_FOUND,
			});
		}

		// Prevent admin from deleting themselves
		if (req.params.id === req.user.id) {
			return res.status(400).json({
				success: false,
				message: "You cannot delete your own account",
			});
		}

		await user.deleteOne();

		res.json({
			success: true,
			message: SUCCESS_MESSAGE.USER_DELETED,
		});
	} catch (error) {
		console.error("Delete user error:", error);
		res.status(500).json({
			success: false,
			message: ERROR_MESSAGES.SERVER_ERROR,
		});
	}
};

// @desc    Reset user password
// @route   PUT /api/admin/users/:id/reset-password
// @access  Private/Admin
export const resetUserPassword = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				message: ERROR_MESSAGES.VALIDATION_FAILED,
				errors: errors.array(),
			});
		}

		const { newPassword } = req.body;

		const user = await User.findById(req.params.id);

		if (!user) {
			return res.status(404).json({
				success: false,
				message: ERROR_MESSAGES.USER_NOT_FOUND,
			});
		}

		// Hash new password
		user.password = await bcrypt.hash(newPassword, 12);
		await user.save();

		res.json({
			success: true,
			message: "Password reset successfully",
		});
	} catch (error) {
		console.error("Reset password error:", error);
		res.status(500).json({
			success: false,
			message: ERROR_MESSAGES.SERVER_ERROR,
		});
	}
};

// @desc    Toggle user active status
// @route   PATCH /api/admin/users/:id/toggle-status
// @access  Private/Admin
export const toggleUserStatus = async (req, res) => {
	try {
		const user = await User.findById(req.params.id);

		if (!user) {
			return res.status(404).json({
				success: false,
				message: ERROR_MESSAGES.USER_NOT_FOUND,
			});
		}

		// Prevent admin from deactivating themselves
		if (req.params.id === req.user.id) {
			return res.status(400).json({
				success: false,
				message: "You cannot deactivate your own account",
			});
		}

		user.isActive = !user.isActive;
		await user.save();

		res.json({
			success: true,
			message: `User ${user.isActive ? "activated" : "deactivated"} successfully`,
			data: { isActive: user.isActive },
		});
	} catch (error) {
		console.error("Toggle user status error:", error);
		res.status(500).json({
			success: false,
			message: ERROR_MESSAGES.SERVER_ERROR,
		});
	}
};

// @desc    Get user statistics
// @route   GET /api/admin/users/stats
// @access  Private/Admin
export const getUserStats = async (req, res) => {
	try {
		const totalUsers = await User.countDocuments();
		const activeUsers = await User.countDocuments({ isActive: true });
		const inactiveUsers = await User.countDocuments({ isActive: false });
		const adminUsers = await User.countDocuments({ role: "admin" });
		const regularUsers = await User.countDocuments({ role: "user" });

		// Users registered in last 30 days
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
		const newUsers = await User.countDocuments({
			createdAt: { $gte: thirtyDaysAgo },
		});

		// Get recent users
		const recentUsers = await User.find()
			.select("name email userName role createdAt")
			.sort({ createdAt: -1 })
			.limit(5)
			.lean();

		res.json({
			success: true,
			data: {
				stats: {
					total: totalUsers,
					active: activeUsers,
					inactive: inactiveUsers,
					admins: adminUsers,
					regular: regularUsers,
					newUsersLast30Days: newUsers,
				},
				recentUsers,
			},
		});
	} catch (error) {
		console.error("Get user stats error:", error);
		res.status(500).json({
			success: false,
			message: ERROR_MESSAGES.SERVER_ERROR,
		});
	}
};

// @desc    Bulk delete users
// @route   POST /api/admin/users/bulk-delete
// @access  Private/Admin
export const bulkDeleteUsers = async (req, res) => {
	try {
		const { userIds } = req.body;

		if (!Array.isArray(userIds) || userIds.length === 0) {
			return res.status(400).json({
				success: false,
				message: "Please provide an array of user IDs",
			});
		}

		// Prevent admin from deleting themselves
		if (userIds.includes(req.user.id)) {
			return res.status(400).json({
				success: false,
				message: "You cannot delete your own account",
			});
		}

		const result = await User.deleteMany({
			_id: { $in: userIds },
		});

		res.json({
			success: true,
			message: `${result.deletedCount} users deleted successfully`,
			data: { deletedCount: result.deletedCount },
		});
	} catch (error) {
		console.error("Bulk delete users error:", error);
		res.status(500).json({
			success: false,
			message: ERROR_MESSAGES.SERVER_ERROR,
		});
	}
};
