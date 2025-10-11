	import { validationResult } from "express-validator";
import Category from "../models/Category.js";
import Question from "../models/Question.js";

	// Utility to get all subcategory IDs recursively
	const getAllSubcategoryIds = async (categoryId) => {
		const allCategories = await Category.find().select("_id parentCategory").lean();

		const collectIds = (id) => {
			const children = allCategories.filter(
				(cat) => cat.parentCategory?.toString() === id.toString()
			);
			const ids = children.map((c) => c._id.toString());
			for (const childId of ids) {
				ids.push(...collectIds(childId));
			}
			return ids;
		};

		return collectIds(categoryId);
	};

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
			if (tags)
				query.tags = { $in: tags.split(",").map((t) => t.trim().toLowerCase()) };
			if (search) query.$text = { $search: search };

			if (category) {
				const subcategoryIds = await getAllSubcategoryIds(category);
				query.category = { $in: [category, ...subcategoryIds] };
			}

			const sortOptions = {};
			if (search) {
				sortOptions.score = { $meta: "textScore" };
			} else if (sortBy === "popular") {
				sortOptions["stats.views"] = -1;
				sortOptions["stats.likes"] = -1;
			} else {
				sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;
			}

			const questions = await Question.find(query)
				.populate("category", "name slug color")
				.populate("author", "name username")
				.sort(sortOptions)
				.skip((page - 1) * limit)
				.limit(Number(limit))
				.select("-solutions -hints");

			const total = await Question.countDocuments(query);

			res.json({
				success: true,
				data: {
					results: questions,
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
				return res
					.status(400)
					.json({ success: false, message: "Category not found" });
			}

			const slug = req.body.title
				.toLowerCase()
				.trim()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/(^-|-$)+/g, "")
				.concat("-", Date.now().toString(36).slice(-4)); // Ensure uniqueness

			const question = new Question({
				...req.body,
				author: req.user.id,
				tags: req.body.tags?.map((tag) => tag.trim().toLowerCase()) || [],
				slug,
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
			const validCategories = await Category.find({
				_id: { $in: categoryIds },
			}).select("_id");
			const validCategoryIds = validCategories.map((c) => c._id.toString());

			const invalidCategory = categoryIds.find(
				(id) => !validCategoryIds.includes(id)
			);
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
				slug: q.title
					.toLowerCase()
					.trim()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/(^-|-$)+/g, "")
					.concat("-", Date.now().toString(36).slice(-4)),
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
			const { id: slug } = req.params;

			const question = await Question.findOne({
				slug:slug,
				status: "published", // ⬅ filter directly in the query
			})
				.populate("category", "name slug color")
				.populate("author", "name username avatar")
				.populate("relatedQuestions", "title difficulty category")
				.populate("contributors.user", "name username");

			if (!question) {
				return res.status(404).json({
					success: false,
					message: "Question not found or not published",
				});
			}

			await question.incrementViews();

			res.json({ success: true, data: question });
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
		const userId = req.user._id;

		console.log("userId:", userId);
		try {
			const question = await Question.findById(req.params.id);
			if (!question) {
				return res
					.status(404)
					.json({ success: false, message: "Question not found" });
			}

			await question.toggleLike(true);
			if (!question.likedBy.includes(userId)) {
				await question.likedBy.push(userId);
				await question.save();
			} else {
				await question.toggleLike(false);
				await question.likedBy.pull(userId);
				await question.save();

				return res.json({
					success: true,
					message: "Question unliked",
					data: { likes: question.stats.likes },
				});
			}

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

	export const bookmarkQuestion = async (req, res) => {
		const userId = req.user._id;
		try {
			const question = await Question.findById(req.params.id);
			if (!question) {
				return res

					.status(404)
					.json({ success: false, message: "Question not found" });
			}
			await question.toggleBookmark(true);
			if (!question.bookmarkedBy.includes(userId)) {
				await question.bookmarkedBy.push(userId);
				await question.save();
			} else {
				await question.toggleBookmark(false);
				await question.bookmarkedBy.pull(userId);
				await question.save();
				return res.json({
					success: true,
					message: "Question unbookmarked",
					data: { bookmarks: question.stats.bookmarks },
				});
			}
			res.json({
				success: true,
				message: "Question bookmarked",
				data: { bookmarks: question.stats.bookmarks },
			});
		} catch (err) {
			console.error("Bookmark question error:", err);
			res.status(500).json({ success: false, message: "Server error" });
		}
	};


	// Get Most Popular Questions
	export const getPopularQuestions = async (req, res) => {
		try {
			const { limit = 10, category } = req.query;
			const filter = { status: "published" };

			if (category) {
				const subcategoryIds = await getAllSubcategoryIds(category);
				filter.category = { $in: [category, ...subcategoryIds] };
			}

			const questions = await Question.find(filter)
				.sort({ "stats.views": -1, "stats.likes": -1 })
				.limit(Number(limit))
				.populate("category", "name slug color")
				.populate("author", "name username");

			res.json({ success: true, data: { questions } });
		} catch (err) {
			console.error("Popular questions error:", err);
			res.status(500).json({ success: false, message: "Server error" });
		}
	};
