import express from "express";
import { body } from "express-validator";
import {
	bulkDeleteUsers,
	createUser,
	deleteUser,
	getAllUsers,
	getUserById,
	getUserStats,
	resetUserPassword,
	toggleUserStatus,
	updateUser,
} from "../controller/admin-user-controller.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Apply authentication and admin authorization to all routes
router.use(auth);
router.use(adminAuth);

// @route   GET /api/admin/users/stats
// @desc    Get user statistics
// @access  Private/Admin
router.get("/stats", getUserStats);

// @route   GET /api/admin/users
// @desc    Get all users with pagination and filters
// @access  Private/Admin
router.get("/", getAllUsers);

// @route   GET /api/admin/users/:id
// @desc    Get user by ID
// @access  Private/Admin
router.get("/:id", getUserById);

// @route   POST /api/admin/users
// @desc    Create new user
// @access  Private/Admin
router.post(
	"/",
	[
		body("name").trim().notEmpty().withMessage("Name is required"),
		body("email").isEmail().withMessage("Please provide a valid email"),
		body("userName")
			.trim()
			.isLength({ min: 3, max: 20 })
			.withMessage("Username must be between 3 and 20 characters")
			.matches(/^[a-zA-Z0-9_]+$/)
			.withMessage(
				"Username can only contain letters, numbers, and underscores"
			),
		body("password")
			.isLength({ min: 6 })
			.withMessage("Password must be at least 6 characters"),
		body("role")
			.optional()
			.isIn(["user", "admin"])
			.withMessage("Role must be either user or admin"),
	],
	createUser
);

// @route   PUT /api/admin/users/:id
// @desc    Update user
// @access  Private/Admin
router.put(
	"/:id",
	[
		body("name")
			.optional()
			.trim()
			.notEmpty()
			.withMessage("Name cannot be empty"),
		body("email")
			.optional()
			.isEmail()
			.withMessage("Please provide a valid email"),
		body("userName")
			.optional()
			.trim()
			.isLength({ min: 3, max: 20 })
			.withMessage("Username must be between 3 and 20 characters")
			.matches(/^[a-zA-Z0-9_]+$/)
			.withMessage(
				"Username can only contain letters, numbers, and underscores"
			),
		body("role")
			.optional()
			.isIn(["user", "admin"])
			.withMessage("Role must be either user or admin"),
	],
	updateUser
);

// @route   DELETE /api/admin/users/:id
// @desc    Delete user
// @access  Private/Admin
router.delete("/:id", deleteUser);

// @route   PUT /api/admin/users/:id/reset-password
// @desc    Reset user password
// @access  Private/Admin
router.put(
	"/:id/reset-password",
	[
		body("newPassword")
			.isLength({ min: 6 })
			.withMessage("Password must be at least 6 characters"),
	],
	resetUserPassword
);

// @route   PATCH /api/admin/users/:id/toggle-status
// @desc    Toggle user active status
// @access  Private/Admin
router.patch("/:id/toggle-status", toggleUserStatus);

// @route   POST /api/admin/users/bulk-delete
// @desc    Bulk delete users
// @access  Private/Admin
router.post("/bulk-delete", bulkDeleteUsers);

export default router;
