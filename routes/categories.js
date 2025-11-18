import express from "express";
import { body } from "express-validator";
import {
	bulkUploadCategories,
	createCategory,
	deleteCategory,
	getAllCategories,
	getCategoryBySlug,
	updateCategory,
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
	],
	createCategory
);

CategoriesRouter.put(
	"/:id",
	auth,
	adminAuth,
	[
		body("name")
			.optional()
			.trim()
			.isLength({ min: 2, max: 50 })
			.withMessage("Name must be between 2 and 50 characters"),
		body("description")
			.optional()
			.trim()
			.isLength({ max: 500 })
			.withMessage("Description cannot exceed 500 characters"),
	],
	updateCategory
);

CategoriesRouter.delete("/:id", auth, adminAuth, deleteCategory);

CategoriesRouter.post(
	"/bulk",
	auth,
	adminAuth,
	[
		body("categories")
			.isArray({ min: 1 })
			.withMessage("At least one category is required"),
		body("categories.*.name")
			.trim()
			.isLength({ min: 2, max: 50 })
			.withMessage("Category name must be between 2 and 50 characters"),
		body("categories.*.slug")
			.trim()
			.isLength({ min: 2, max: 50 })
			.withMessage("Category slug must be between 2 and 50 characters"),
		body("categories.*.description")
			.optional()
			.trim()
			.isLength({ max: 500 })
			.withMessage("Description cannot exceed 500 characters"),
		body("categories.*.color")
			.optional()
			.matches(/^#[0-9A-F]{6}$/i)
			.withMessage("Color must be a valid hex color"),
		body("categories.*.icon")
			.optional()
			.isString()
			.withMessage("Icon must be a string"),
		body("categories.*.parentCategory")
			.optional()
			.isMongoId()
			.withMessage("Invalid parent category ID"),
		body("categories.*.subcategories"),
	],
	bulkUploadCategories
);

export default CategoriesRouter;
