import { validationResult } from "express-validator";
import Category from "../models/Category.js";
import Question from "../models/Question.js";

export const getQuestions = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res
				.status(400)
				.json({
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
		if (tags)
			query.tags = { $in: tags.split(",").map((t) => t.trim().toLowerCase()) };
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
				questions,
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

export const getSingleQuestion = async (req, res) => {
	try {
		const question = await Question.findById(req.params.id)
			.populate("category", "name slug color")
			.populate("author", "name username avatar")
			.populate("relatedQuestions", "title difficulty category")
			.populate("contributors.user", "name username");

		if (!question || question.status !== "published")
			return res
				.status(404)
				.json({ success: false, message: "Question not found" });

		await question.incrementViews();

		res.json({ success: true, data: { question } });
	} catch (err) {
		console.error("Get question error:", err);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

export const createQuestion = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res
				.status(400)
				.json({
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				});
		}

		const category = await Category.findById(req.body.category);
		if (!category) {
			return res
				.status(400)
				.json({ success: false, message: "Category not found" });
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

		res
			.status(201)
			.json({ success: true, message: "Question created", data: { question } });
	} catch (err) {
		console.error("Create question error:", err);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

export const updateQuestion = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res
				.status(400)
				.json({
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				});
		}

		const question = await Question.findById(req.params.id);
		if (!question)
			return res
				.status(404)
				.json({ success: false, message: "Question not found" });

		if (
			question.author.toString() !== req.user.id &&
			req.user.role !== "admin"
		) {
			return res
				.status(403)
				.json({ success: false, message: "Not authorized" });
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

export const deleteQuestion = async (req, res) => {
	try {
		const question = await Question.findById(req.params.id);
		if (!question)
			return res
				.status(404)
				.json({ success: false, message: "Question not found" });

		if (
			question.author.toString() !== req.user.id &&
			req.user.role !== "admin"
		) {
			return res
				.status(403)
				.json({ success: false, message: "Not authorized" });
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

export const likeQuestion = async (req, res) => {
	try {
		const question = await Question.findById(req.params.id);
		if (!question)
			return res
				.status(404)
				.json({ success: false, message: "Question not found" });

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
