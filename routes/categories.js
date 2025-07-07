import express from "express";
import { body } from "express-validator";
import {
	createCategory,
	getAllCategories,
	getCategoryBySlug,
} from "../controller/categories-controller.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { auth } from "../middleware/auth.js";


const CategoriesRouter = express.Router();

// Public
CategoriesRouter.get("/", getAllCategories);
CategoriesRouter.get("/:slug", getCategoryBySlug);

// Admin-only
CategoriesRouter.post(
	"/",
	auth,
	adminAuth,
	[
		body("name")
			.trim()
			.isLength({ min: 2, max: 50 })
			.withMessage("Name must be between 2 and 50 characters"),
		body("description")
			.optional()
			.trim()
			.isLength({ max: 500 })
			.withMessage("Description cannot exceed 500 characters"),
		body("color")
			.optional()
			.matches(/^#[0-9A-F]{6}$/i)
			.withMessage("Color must be a valid hex color"),
		body("parentCategory")
			.optional()
			.isMongoId()
			.withMessage("Invalid parent category ID"),
	],
	createCategory
);

export default CategoriesRouter;
