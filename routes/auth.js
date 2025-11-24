import express from "express";
import { body } from "express-validator";
import {
	changePassword,
	deleteAccount,
	deleteAvatar,
	exportUserData,
	getMe,
	login,
	logout,
	register,
	updatePreferences,
	updateProfile,
	uploadAvatar,
} from "../controller/auth-controller.js";
import { oauthLogin } from "../controller/oauth-controller.js";
import { requireRole } from "../middleware/adminAuth.js";
import { auth } from "../middleware/auth.js";
import { refreshTokenMiddleware } from "../middleware/refreshToken.js";
import { upload } from "../middleware/upload.js";

const AuthRouter = express.Router();

// Register
AuthRouter.get("/refresh-token", refreshTokenMiddleware, (req, res) => {
	res.json({
		success: true,
		message: "Access token refreshed",
	});
});
AuthRouter.post(
	"/register",
	[
		body("name")
			.trim()
			.isLength({ min: 2, max: 50 })
			.withMessage("Name must be between 2 and 50 characters"),
		body("email")
			.isEmail()
			.normalizeEmail()
			.withMessage("Please provide a valid email"),
		body("username")
			.trim()
			.isLength({ min: 3, max: 20 })
			.matches(/^[a-zA-Z0-9_]+$/)
			.withMessage(
				"Username must be 3-20 characters and contain only letters, numbers, and underscores"
			),
		body("password")
			.isLength({ min: 6 })
			.withMessage("Password must be at least 6 characters long"),
		body("userRole")
			.optional()
			.isIn(["user", "admin"])
			.withMessage('User role must be either "user" or "admin"'),
	],
	register
);

// Login
AuthRouter.post(
	"/login",
	[
		body("email")
			.trim()
			.notEmpty()
			.withMessage("Email or username is required"),
		body("password").notEmpty().withMessage("Password is required"),
	],
	login
);

// OAuth Login/Register
AuthRouter.post("/oauth", oauthLogin);

// Get current user
AuthRouter.get("/me", auth, getMe);

// Update profile
AuthRouter.put("/profile", auth, updateProfile);

// Upload avatar
AuthRouter.post("/avatar", auth, upload.single("avatar"), uploadAvatar);

// Delete avatar
AuthRouter.delete("/avatar", auth, deleteAvatar);

// Update preferences
AuthRouter.put("/preferences", auth, updatePreferences);

// Export user data
AuthRouter.get("/export-data", auth, exportUserData);

// Delete account
AuthRouter.delete("/account", auth, deleteAccount);

// Logout
AuthRouter.post("/logout", auth, logout);

// Change password
AuthRouter.put(
	"/change-password",
	auth,
	[
		body("currentPassword")
			.notEmpty()
			.withMessage("Current password is required"),
		body("newPassword")
			.isLength({ min: 6 })
			.withMessage("New password must be at least 6 characters long"),
	],
	changePassword
);

AuthRouter.get("/admin/dashboard", auth, requireRole(["admin"]), (req, res) => {
	res.json({ message: "Welcome Admin!" });
});

export default AuthRouter;
