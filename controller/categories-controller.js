import { validationResult } from "express-validator";
import Category from "../models/Category.js";

// GET /api/categories
export const getAllCategories = async (req, res) => {
	try {
		const categories = await Category.getWithCounts();
		res.json({ success: true, data: { categories } });
	} catch (error) {
		console.error("Get categories error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// GET /api/categories/:slug
export const getCategoryBySlug = async (req, res) => {
	try {
		const category = await Category.findOne({
			slug: req.params.slug,
			isActive: true,
		});

		if (!category) {
			return res.status(404).json({
				success: false,
				message: "Category not found",
			});
		}

		res.json({ success: true, data: { category } });
	} catch (error) {
		console.error("Get category error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// POST /api/categories
export const createCategory = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				message: "Validation failed",
				errors: errors.array(),
			});
		}

		const { name, description, color, parentCategory } = req.body;

		const slug = name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)+/g, "");

		const category = new Category({
			name,
			description,
			color,
			parentCategory,
			slug, // include manually generated slug
		});
		await category.save();

		res.status(201).json({
			success: true,
			message: "Category created successfully",
			data: { category },
		});
	} catch (error) {
		console.error("Create category error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};
