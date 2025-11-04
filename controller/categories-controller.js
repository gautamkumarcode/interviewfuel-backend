import { validationResult } from "express-validator";
import Category from "../models/Category.js";

/**
 * Helper to build nested category tree
 */
const buildCategoryTree = (categories, parentId = null) => {
	const tree = [];

	categories.forEach((category) => {
		if (
			(parentId === null && !category.parentCategory) ||
			(category.parentCategory && category?.parentCategory?.toString() === parentId?.toString())
		) {
			const children = buildCategoryTree(categories, category._id);
			tree.push({ ...category, subcategories: children });
		}
	});

	return tree;
};


// GET /api/categories
export const getAllCategoriesInTree = async (req, res) => {
	try {
		// Fetch all categories
		const categories = await Category.find().sort({ order: 1, name: 1 }).lean();

		// Populate question counts (optional)
		const withStats = await Promise.all(
			categories.map(async (cat) => {
				const count = await Category.aggregate([
					{ $match: { _id: cat._id } },
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
					{ $project: { questions: 0 } },
				]);
				return count[0] || cat;
			})
		);

		// Build nested structure using parentCategory
		const tree = buildCategoryTree(withStats);

		res.json({
			success: true,
			data: {
				results: tree,
				total: categories.length,
			},
		});
	} catch (error) {
		console.error("Get categories error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

export const getAllCategories = async (req, res) => {
	try {
		// Fetch all categories
		const categories = await Category.find().sort({ order: 1, name: 1 }).lean();

		res.json({
			success: true,
			data: {
				results: categories,
				total: categories.length,
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

		const {
			name,
			description,
			color,
			icon,
			parentCategory = null,
			tags = [],
			order = 0,
		} = req.body;

		const slug = name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)+/g, "");

		const category = await Category.create({
			name,
			slug,
			description,
			color,
			icon,
			parentCategory,
			tags,
			order,
		});

		return res.status(201).json({
			success: true,
			message: "Category created successfully",
			data: { category },
		});
	} catch (error) {
		console.error("Create category error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// POST /api/categories/bulk
export const bulkUploadCategories = async (req, res) => {
	try {
		const { categories } = req.body;

		if (!Array.isArray(categories) || categories.length === 0) {
			return res.status(400).json({
				success: false,
				message: "Categories array is required and cannot be empty",
			});
		}

		const createdCategories = [];

		for (const cat of categories) {
			const {
				name,
				description,
				color,
				icon,
				parentCategory = null,
				tags = [],
				order = 0,
			} = cat;

			if (!name) continue;

			const slug = name
				.toLowerCase()
				.trim()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/(^-|-$)+/g, "");

			const newCategory = await Category.create({
				name,
				slug,
				description,
				color,
				icon,
				parentCategory,
				tags,
				order,
			});

			createdCategories.push(newCategory);
		}

		res.status(201).json({
			success: true,
			message: `${createdCategories.length} categories created successfully`,
			data: { categories: createdCategories },
		});
	} catch (error) {
		console.error("Bulk upload error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// PUT /api/categories/:id
export const updateCategory = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				message: "Validation failed",
				errors: errors.array(),
			});
		}

		const { id } = req.params;
		const updateData = req.body;

		// If name is being updated, regenerate slug
		if (updateData.name) {
			updateData.slug = updateData.name
				.toLowerCase()
				.trim()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/(^-|-$)+/g, "");
		}

		const category = await Category.findByIdAndUpdate(
			id,
			updateData,
			{ new: true, runValidators: true }
		);

		if (!category) {
			return res.status(404).json({
				success: false,
				message: "Category not found",
			});
		}

		res.json({
			success: true,
			message: "Category updated successfully",
			data: { category },
		});
	} catch (error) {
		console.error("Update category error:", error);
		if (error.code === 11000) {
			return res.status(400).json({
				success: false,
				message: "Category name or slug already exists",
			});
		}
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// DELETE /api/categories/:id
export const deleteCategory = async (req, res) => {
	try {
		const { id } = req.params;

		// Check if category exists
		const category = await Category.findById(id);
		if (!category) {
			return res.status(404).json({
				success: false,
				message: "Category not found",
			});
		}

		// Check if category has questions
		const questionCount = await Question.countDocuments({ category: id });
		if (questionCount > 0) {
			return res.status(400).json({
				success: false,
				message: `Cannot delete category. It has ${questionCount} questions associated with it.`,
			});
		}

		// Check if category has subcategories
		const subcategoryCount = await Category.countDocuments({ parentCategory: id });
		if (subcategoryCount > 0) {
			return res.status(400).json({
				success: false,
				message: `Cannot delete category. It has ${subcategoryCount} subcategories.`,
			});
		}

		await Category.findByIdAndDelete(id);

		res.json({
			success: true,
			message: "Category deleted successfully",
		});
	} catch (error) {
		console.error("Delete category error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};
