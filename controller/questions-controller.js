import { validationResult } from "express-validator";
import Category from "../models/Category.js";
import Question from "../models/Question.js";

// Get All Questions with Filters
export const getQuestions = async (req, res) => {
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
			page = 1,
			limit = 20,
			difficulty,
			category,
			search,
			sortBy = "createdAt",
			sortOrder = "desc",
			tags,
		} = req.query;

		const query = { status: "published" };
		if (difficulty) query.difficulty = difficulty;
		if (category) query.category = category;
		if (tags) query.tags = { $in: tags.split(",").map((t) => t.trim().toLowerCase()) };
		if (search) query.$text = { $search: search };

		const sortOptions = {};
		if (search) sortOptions.score = { $meta: "textScore" };
		sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

		const questions = await Question.find(query)
			.populate("category", "name slug color")
			.populate("author", "name username")
			.sort(sortOptions)
			.limit(limit * 1)
			.skip((page - 1) * limit)
			.select("-solutions -hints");

		const total = await Question.countDocuments(query);

		res.json({
			success: true,
			data: {
				results:questions,
				pagination: {
					current: Number(page),
					pages: Math.ceil(total / limit),
					total,
					limit: Number(limit),
				},
			},
		});
	} catch (err) {
		console.error("Get questions error:", err);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Create a Single Question
export const createQuestion = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				message: "Validation failed",
				errors: errors.array(),
			});
		}

		const category = await Category.findById(req.body.category);
		if (!category) {
			return res.status(400).json({ success: false, message: "Category not found" });
		}

		const question = new Question({
			...req.body,
			author: req.user.id,
			tags: req.body.tags?.map((tag) => tag.trim().toLowerCase()) || [],
		});

		await question.save();
		await question.populate("category", "name slug color");
		await question.populate("author", "name username");
		await category.updateQuestionCount();

		res.status(201).json({
			success: true,
			message: "Question created",
			data: { question },
		});
	} catch (err) {
		console.error("Create question error:", err);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// ✅ Bulk Upload Multiple Questions
export const createMultipleQuestions = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				message: "Validation failed",
				errors: errors.array(),
			});
		}

		const questionsInput = req.body;
		if (!Array.isArray(questionsInput) || questionsInput.length === 0) {
			return res.status(400).json({
				success: false,
				message: "Request body must be a non-empty array of questions.",
			});
		}

		const categoryIds = [...new Set(questionsInput.map((q) => q.category))];
		const validCategories = await Category.find({ _id: { $in: categoryIds } }).select("_id");
		const validCategoryIds = validCategories.map((c) => c._id.toString());

		const invalidCategory = categoryIds.find((id) => !validCategoryIds.includes(id));
		if (invalidCategory) {
			return res.status(400).json({
				success: false,
				message: `Invalid category ID: ${invalidCategory}`,
			});
		}

		const questionsToInsert = questionsInput.map((q) => ({
			...q,
			author: req.user.id,
			tags: q.tags?.map((tag) => tag.trim().toLowerCase()) || [],
			bestPractices: q.bestPractices || [],
			hints: (q.hints || []).map((h, i) => ({
				order: h.order ?? i + 1,
				content: h.content,
			})),
			companies: (q.companies || []).map((comp) => ({
				name: comp.name,
				frequency: comp.frequency || 1,
			})),
			solutions: (q.solutions || []).map((sol) => ({
				title: sol.title,
				language: sol.language,
				code: sol.code,
				explanation: sol.explanation,
				timeComplexity: sol.timeComplexity || "",
				spaceComplexity: sol.spaceComplexity || "",
			})),
			media: q.media || [],
			richAnswer: q.richAnswer || "",
			status: q.status || "published",
		}));

		const createdQuestions = await Question.insertMany(questionsToInsert);

		for (const categoryId of validCategoryIds) {
			const category = await Category.findById(categoryId);
			if (category) await category.updateQuestionCount();
		}

		res.status(201).json({
			success: true,
			message: `${createdQuestions.length} questions created successfully`,
			data: { questions: createdQuestions },
		});
	} catch (err) {
		console.error("Create multiple questions error:", err);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Get Single Question
export const getSingleQuestion = async (req, res) => {
	try {
		const question = await Question.findById(req.params.id)
			.populate("category", "name slug color")
			.populate("author", "name username avatar")
			.populate("relatedQuestions", "title difficulty category")
			.populate("contributors.user", "name username");

		if (!question || question.status !== "published") {
			return res.status(404).json({ success: false, message: "Question not found" });
		}

		await question.incrementViews();

		res.json({ success: true, data: question  });
	} catch (err) {
		console.error("Get question error:", err);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Update Question
export const updateQuestion = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				message: "Validation failed",
				errors: errors.array(),
			});
		}

		const question = await Question.findById(req.params.id);
		if (!question) {
			return res.status(404).json({ success: false, message: "Question not found" });
		}

		if (question.author.toString() !== req.user.id && req.user.role !== "admin") {
			return res.status(403).json({ success: false, message: "Not authorized" });
		}

		Object.assign(question, req.body);
		if (req.body.tags)
			question.tags = req.body.tags.map((tag) => tag.trim().toLowerCase());

		await question.save();
		await question.populate("category", "name slug color");
		await question.populate("author", "name username");

		res.json({
			success: true,
			message: "Question updated",
			data: { question },
		});
	} catch (err) {
		console.error("Update question error:", err);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Delete Question
export const deleteQuestion = async (req, res) => {
	try {
		const question = await Question.findById(req.params.id);
		if (!question) {
			return res.status(404).json({ success: false, message: "Question not found" });
		}

		if (question.author.toString() !== req.user.id && req.user.role !== "admin") {
			return res.status(403).json({ success: false, message: "Not authorized" });
		}

		await Question.findByIdAndDelete(req.params.id);

		const category = await Category.findById(question.category);
		if (category) await category.updateQuestionCount();

		res.json({ success: true, message: "Question deleted successfully" });
	} catch (err) {
		console.error("Delete question error:", err);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Like Question
export const likeQuestion = async (req, res) => {
	try {
		const question = await Question.findById(req.params.id);
		if (!question) {
			return res.status(404).json({ success: false, message: "Question not found" });
		}

		await question.toggleLike(true);
		res.json({
			success: true,
			message: "Question liked",
			data: { likes: question.stats.likes },
		});
	} catch (err) {
		console.error("Like question error:", err);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Get Most Popular Questions
export const getPopularQuestions = async (req, res) => {
	try {
		const { limit = 10 } = req.query;
		const questions = await Question.getPopular(Number(limit));
		res.json({ success: true, data: { questions } });
	} catch (err) {
		console.error("Popular questions error:", err);
		res.status(500).json({ success: false, message: "Server error" });
	}
};
