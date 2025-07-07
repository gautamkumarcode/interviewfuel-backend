import express from "express";
import { body } from "express-validator";
import { getProfile, updateProfile } from "../controller/user-controller.js";
import { auth } from "../middleware/auth.js";

const UserRouter = express.Router();

UserRouter.get("/profile", auth, getProfile);

UserRouter.put(
	"/profile",
	auth,
	[
		body("name")
			.optional()
			.trim()
			.isLength({ min: 2, max: 50 })
			.withMessage("Name must be between 2 and 50 characters"),
		body("bio")
			.optional()
			.trim()
			.isLength({ max: 500 })
			.withMessage("Bio cannot exceed 500 characters"),
		body("location")
			.optional()
			.trim()
			.isLength({ max: 100 })
			.withMessage("Location cannot exceed 100 characters"),
		body("website")
			.optional()
			.trim()
			.isURL()
			.withMessage("Please provide a valid URL"),
	],
	updateProfile
);

export default UserRouter;
