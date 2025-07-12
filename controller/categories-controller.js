import { validationResult } from "express-validator";
import Category from "../models/Category.js";

// GET /api/categories
export const getAllCategories = async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		// Get total count of categories
		const totalCountAgg = await Category.aggregate([
			{
				$count: "total",
			},
		]);

		const total = totalCountAgg[0]?.total || 0;
		const totalPages = Math.ceil(total / limit);

		// Get paginated categories with counts
		const categories = await Category.aggregate([
			{
				$lookup: {
					from: "questions",
					localField: "_id",
					foreignField: "category",
					as: "questions",
				},
			},
			{
				$addFields: {
					"stats.questionCount": { $size: "$questions" },
				},
			},
			{
				$project: {
					questions: 0,
				},
			},
			{
				$sort: { order: 1, name: 1 },
			},
			{ $skip: skip },
			{ $limit: limit },
		]);

		res.json({
			success: true,
			data: {
				results: categories,
				pagination: {
					current: page,
					total,
					totalPages,
					limit,
				},
			},
		});
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
