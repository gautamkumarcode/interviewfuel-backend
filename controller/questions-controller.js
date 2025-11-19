import { validationResult } from "express-validator";
import Category from "../models/Category.js";
import Comment from "../models/Comment.js";
import Question from "../models/Question.js";

// Utility to get all subcategory IDs recursively
const getAllSubcategoryIds = async (rootCategoryId) => {
	const allCategories = await Category.find({})
		.select("_id parentCategory slug")
		.lean();

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

	return [rootCategoryId.toString(), ...collectIds(rootCategoryId)];
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
			query.tags = {
				$in: tags.split(",").map((t) => t.trim().toLowerCase()),
			};
		if (search) query.$text = { $search: search };

		if (category) {
			// Step 1: Find the root category by slug
			const rootCategory = await Category.findOne({ slug: category }).select(
				"_id"
			);

			if (rootCategory) {
				// Step 2: Collect all subcategory IDs including the root
				const categoryIds = await getAllSubcategoryIds(rootCategory._id);
				query.category = { $in: categoryIds };
			} else {
				// If slug is invalid
				return res.status(404).json({
					success: false,
					message: "Category not found",
				});
			}
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
			.select(
				"id category stats title tags difficulty timeLimit slug createdAt updatedAt"
			);

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

		// Set reviewStatus based on user role
		const reviewStatus = req.user.role === "admin" ? "approved" : "pending";
		const status =
			req.user.role === "admin" ? req.body.status || "published" : "draft";

		const question = new Question({
			...req.body,
			author: req.user.id,
			tags: req.body.tags?.map((tag) => tag.trim().toLowerCase()) || [],
			slug,
			reviewStatus,
			status,
			// If admin creates, auto-verify
			...(req.user.role === "admin" && {
				isVerified: true,
				verifiedBy: req.user.id,
				verifiedAt: new Date(),
			}),
		});

		await question.save();
		await question.populate("category", "name slug color");
		await question.populate("author", "name username");
		await category.updateQuestionCount();

		res.status(201).json({
			success: true,
			message:
				req.user.role === "admin"
					? "Question created and published"
					: "Question created and submitted for review",
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
		const { id } = req.params;

		// Try to find by ObjectId first, then by slug
		let question;

		// Check if the id is a valid MongoDB ObjectId (24 character hex string)
		const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

		if (isObjectId) {
			// Find by ObjectId
			question = await Question.findById(id)
				.populate("category", "name slug color")
				.populate("author", "name username avatar")
				.populate("relatedQuestions", "title difficulty category")
				.populate("contributors.user", "name username");
		} else {
			// Find by slug
			question = await Question.findOne({ slug: id })
				.populate("category", "name slug color")
				.populate("author", "name username avatar")
				.populate("relatedQuestions", "title difficulty category")
				.populate("contributors.user", "name username");
		}

		if (!question) {
			return res.status(404).json({
				success: false,
				message: "Question not found",
			});
		}

		// Check if question is published OR user is author/admin
		const isPublished = question.status === "published";
		const isAuthor = req.user && question.author._id.toString() === req.user.id;
		const isAdmin = req.user && req.user.role === "admin";

		if (!isPublished && !isAuthor && !isAdmin) {
			return res.status(403).json({
				success: false,
				message: "This question is not published yet",
			});
		}

		// Only increment views for published questions
		if (isPublished) {
			await question.incrementViews();
		}

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
			return res
				.status(404)
				.json({ success: false, message: "Question not found" });
		}

		if (
			question.author.toString() !== req.user.id &&
			req.user.role !== "admin"
		) {
			return res
				.status(403)
				.json({ success: false, message: "Not authorized" });
		}

		// Create a copy of req.body and remove fields that shouldn't be updated
		const updateData = { ...req.body };
		delete updateData.author; // Don't allow changing author
		delete updateData.slug; // Don't allow changing slug
		delete updateData.createdAt; // Don't allow changing creation date
		delete updateData._id; // Don't allow changing ID

		Object.assign(question, updateData);
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
			return res
				.status(404)
				.json({ success: false, message: "Question not found" });
		}

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

// Like Question
export const likeQuestion = async (req, res) => {
	const userId = req.user._id;

	try {
		const question = await Question.findById(req.params.id);
		if (!question) {
			return res
				.status(404)
				.json({ success: false, message: "Question not found" });
		}

		await question.toggleLike(true);
		if (!question.likedBy.includes(userId)) {
			question.likedBy.push(userId);
			await question.save();
		} else {
			await question.toggleLike(false);
			question.likedBy.pull(userId);
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
			question.bookmarkedBy.push(userId);
			await question.save();
		} else {
			await question.toggleBookmark(false);
			question.bookmarkedBy.pull(userId);
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

export const addComment = async (req, res) => {
	const { questionId } = req.params;
	try {
		const { content, parentComment } = req.body;
		const userId = req.user._id; // assuming auth middleware

		// Check if question exists
		const question = await Question.findById(questionId);
		if (!question) {
			return res
				.status(404)
				.json({ success: false, message: "Question not found" });
		}

		// Create comment
		const comment = await Comment.create({
			question: questionId,
			author: userId,
			content,
			parentComment: parentComment || null,
		});

		// Populate author info for response
		await comment.populate("author", "name username avatar");

		res.status(201).json({
			success: true,
			message: "Comment added successfully",
			data: comment,
		});
	} catch (error) {
		console.error("Add comment error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

export const getComments = async (req, res) => {
	try {
		const { questionId } = req.params;
		const { page = 1, limit = 50 } = req.query; // Increased limit to include replies

		// Check if question exists
		const question = await Question.findById(questionId);
		if (!question) {
			return res
				.status(404)
				.json({ success: false, message: "Question not found" });
		}

		const comments = await Comment.find({
			question: questionId,
			isDeleted: false, // Only fetch non-deleted comments
		})
			.populate("author", "name username avatar")
			.sort({ createdAt: -1 }) // Sort by newest first
			.skip((page - 1) * limit)
			.limit(Number(limit));

		// Count total comments for pagination
		const total = await Comment.countDocuments({
			question: questionId,
			isDeleted: false,
		});

		res.json({
			success: true,
			data: {
				results: comments,
				pagination: {
					current: Number(page),
					pages: Math.ceil(total / limit),
					total,
					limit: Number(limit),
				},
			},
		});
	} catch (error) {
		console.error("Get comments error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Like/Unlike Comment
export const likeComment = async (req, res) => {
	try {
		const { questionId, commentId } = req.params;
		const userId = req.user._id;

		// Check if question exists
		const question = await Question.findById(questionId);
		if (!question) {
			return res
				.status(404)
				.json({ success: false, message: "Question not found" });
		}

		// Find the comment
		const comment = await Comment.findById(commentId);
		if (!comment) {
			return res
				.status(404)
				.json({ success: false, message: "Comment not found" });
		}

		// Check if user already liked the comment
		const hasLiked = comment.likes.includes(userId);

		if (hasLiked) {
			// Unlike the comment
			comment.likes.pull(userId);
			await comment.save();

			res.json({
				success: true,
				message: "Comment unliked",
				data: { likes: comment.likes.length },
			});
		} else {
			// Like the comment
			comment.likes.push(userId);
			await comment.save();

			res.json({
				success: true,
				message: "Comment liked",
				data: { likes: comment.likes.length },
			});
		}
	} catch (error) {
		console.error("Like comment error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Edit Comment
export const editComment = async (req, res) => {
	try {
		const { questionId, commentId } = req.params;
		const { content } = req.body;
		const userId = req.user._id;

		// Check if question exists
		const question = await Question.findById(questionId);
		if (!question) {
			return res
				.status(404)
				.json({ success: false, message: "Question not found" });
		}

		// Find the comment
		const comment = await Comment.findById(commentId);
		if (!comment) {
			return res
				.status(404)
				.json({ success: false, message: "Comment not found" });
		}

		// Check if user owns the comment
		if (comment.author.toString() !== userId.toString()) {
			return res.status(403).json({
				success: false,
				message: "Not authorized to edit this comment",
			});
		}

		// Update the comment
		comment.content = content;
		comment.isEdited = true;
		await comment.save();

		// Populate author info for response
		await comment.populate("author", "name username avatar");

		res.json({
			success: true,
			message: "Comment updated successfully",
			data: comment,
		});
	} catch (error) {
		console.error("Edit comment error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Delete Comment
export const deleteComment = async (req, res) => {
	try {
		const { questionId, commentId } = req.params;
		const userId = req.user._id;

		// Check if question exists
		const question = await Question.findById(questionId);
		if (!question) {
			return res
				.status(404)
				.json({ success: false, message: "Question not found" });
		}

		// Find the comment
		const comment = await Comment.findById(commentId);
		if (!comment) {
			return res
				.status(404)
				.json({ success: false, message: "Comment not found" });
		}

		// Check if user owns the comment or is admin
		if (
			comment.author.toString() !== userId.toString() &&
			req.user.role !== "admin"
		) {
			return res.status(403).json({
				success: false,
				message: "Not authorized to delete this comment",
			});
		}

		// Soft delete - mark as deleted instead of removing from database
		comment.isDeleted = true;
		await comment.save();

		res.json({
			success: true,
			message: "Comment deleted successfully",
		});
	} catch (error) {
		console.error("Delete comment error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Get Related Questions
export const getRelatedQuestions = async (req, res) => {
	try {
		const { questionId } = req.params;
		const { limit = 5 } = req.query;

		// Check if question exists
		const question = await Question.findById(questionId);
		if (!question) {
			return res
				.status(404)
				.json({ success: false, message: "Question not found" });
		}

		// Get related questions using multiple strategies
		const relatedQuestions = await getRelatedQuestionsForQuestion(
			question,
			Number(limit)
		);

		res.json({
			success: true,
			data: {
				results: relatedQuestions,
				total: relatedQuestions.length,
			},
		});
	} catch (error) {
		console.error("Get related questions error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Set Related Questions (Admin only)
export const setRelatedQuestions = async (req, res) => {
	try {
		const { questionId } = req.params;
		const { relatedQuestionIds } = req.body;

		// Check if user is admin
		if (req.user.role !== "admin") {
			return res.status(403).json({
				success: false,
				message: "Only admins can set related questions",
			});
		}

		// Check if question exists
		const question = await Question.findById(questionId);
		if (!question) {
			return res
				.status(404)
				.json({ success: false, message: "Question not found" });
		}

		// Validate that all related question IDs exist
		if (relatedQuestionIds && relatedQuestionIds.length > 0) {
			const existingQuestions = await Question.find({
				_id: { $in: relatedQuestionIds },
				status: "published",
			});

			if (existingQuestions.length !== relatedQuestionIds.length) {
				return res.status(400).json({
					success: false,
					message: "Some related questions do not exist or are not published",
				});
			}
		}

		// Update related questions
		question.relatedQuestions = relatedQuestionIds || [];
		await question.save();

		res.json({
			success: true,
			message: "Related questions updated successfully",
			data: {
				questionId: question._id,
				relatedQuestions: question.relatedQuestions,
			},
		});
	} catch (error) {
		console.error("Set related questions error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Helper function to find related questions using multiple strategies
const getRelatedQuestionsForQuestion = async (question, limit = 5) => {
	const relatedQuestions = [];
	const excludeIds = [question._id];

	// Strategy 1: Use manually set related questions
	if (question.relatedQuestions && question.relatedQuestions.length > 0) {
		const manualRelated = await Question.find({
			_id: { $in: question.relatedQuestions },
			status: "published",
		})
			.populate("category", "name slug color")
			.populate("author", "name username")
			.select("title difficulty category stats tags slug createdAt")
			.limit(limit);

		relatedQuestions.push(...manualRelated);
		excludeIds.push(...manualRelated.map((q) => q._id));
	}

	// Strategy 2: Find questions with similar tags (if we need more)
	if (
		relatedQuestions.length < limit &&
		question.tags &&
		question.tags.length > 0
	) {
		const tagRelated = await Question.find({
			_id: { $nin: excludeIds },
			tags: { $in: question.tags },
			status: "published",
		})
			.populate("category", "name slug color")
			.populate("author", "name username")
			.select("title difficulty category stats tags slug createdAt")
			.sort({ "stats.views": -1, "stats.likes": -1 })
			.limit(limit - relatedQuestions.length);

		relatedQuestions.push(...tagRelated);
		excludeIds.push(...tagRelated.map((q) => q._id));
	}

	// Strategy 3: Find questions in the same category (if we still need more)
	if (relatedQuestions.length < limit) {
		const categoryRelated = await Question.find({
			_id: { $nin: excludeIds },
			category: question.category,
			status: "published",
		})
			.populate("category", "name slug color")
			.populate("author", "name username")
			.select("title difficulty category stats tags slug createdAt")
			.sort({ "stats.views": -1, createdAt: -1 })
			.limit(limit - relatedQuestions.length);

		relatedQuestions.push(...categoryRelated);
		excludeIds.push(...categoryRelated.map((q) => q._id));
	}

	// Strategy 4: Find questions with same difficulty (if we still need more)
	if (relatedQuestions.length < limit) {
		const difficultyRelated = await Question.find({
			_id: { $nin: excludeIds },
			difficulty: question.difficulty,
			status: "published",
		})
			.populate("category", "name slug color")
			.populate("author", "name username")
			.select("title difficulty category stats tags slug createdAt")
			.sort({ "stats.views": -1, createdAt: -1 })
			.limit(limit - relatedQuestions.length);

		relatedQuestions.push(...difficultyRelated);
	}

	return relatedQuestions.slice(0, limit);
};

export const getMyQuestions = async (req, res) => {
	try {
		const userId = req.user._id;
		const questions = await Question.find({ author: userId })
			.populate("category", "name slug color")
			.select(
				"id category stats title tags difficulty timeLimit slug createdAt updatedAt status"
			)
			.sort({ createdAt: -1 });
		res.json({
			success: true,
			data: {
				results: questions,
				pagination: {
					total: questions.length,
				},
			},
		});
	} catch (error) {
		console.error("Get my questions error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

export const getBookmarkedQuestions = async (req, res) => {
	try {
		const userId = req.user._id;
		const questions = await Question.find({ bookmarkedBy: userId })
			.populate("category", "name slug color")
			.select(
				"id category stats title tags difficulty timeLimit slug createdAt updatedAt"
			)
			.sort({ createdAt: -1 });
		res.json({
			success: true,
			data: {
				results: questions,
				pagination: {
					total: questions.length,
				},
			},
		});
	} catch (error) {
		console.error("Get bookmarked questions error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};
export const getLikedQuestions = async (req, res) => {
	try {
		const userId = req.user._id;
		const questions = await Question.find({ likedBy: userId })
			.populate("category", "name slug color")
			.select(
				"id category stats title tags difficulty timeLimit slug createdAt updatedAt"
			)
			.sort({ createdAt: -1 });
		res.json({
			success: true,
			data: {
				results: questions,
				pagination: {
					total: questions.length,
				},
			},
		});
	} catch (error) {
		console.error("Get liked questions error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

export const getAdminQuestions = async (req, res) => {
	try {
		const questions = await Question.find()
			.populate("category", "name slug color")
			.select(
				"id category stats title tags difficulty timeLimit slug createdAt updatedAt"
			)
			.sort({ createdAt: -1 });
		res.json({
			success: true,
			data: {
				results: questions,
				pagination: {
					total: questions.length,
				},
			},
		});
	} catch (error) {
		console.error("Get admin questions error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Get Pending Questions for Admin Review
export const getPendingQuestions = async (req, res) => {
	try {
		const {
			page = 1,
			limit = 20,
			reviewStatus = "pending",
			difficulty,
			category,
		} = req.query;

		const query = { reviewStatus };

		if (difficulty) query.difficulty = difficulty;
		if (category) query.category = category;

		const questions = await Question.find(query)
			.populate("category", "name slug color")
			.populate("author", "name username email avatar")
			.populate("reviewers", "name username")
			.populate("reviewComments.reviewer", "name username")
			.sort({ createdAt: -1 })
			.skip((page - 1) * limit)
			.limit(Number(limit));

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
	} catch (error) {
		console.error("Get pending questions error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Get Single Question for Admin Review (includes all details)
export const getQuestionForReview = async (req, res) => {
	try {
		const { id } = req.params;

		const question = await Question.findById(id)
			.populate("category", "name slug color")
			.populate("author", "name username email avatar bio")
			.populate("reviewers", "name username avatar")
			.populate("reviewComments.reviewer", "name username avatar")
			.populate("relatedQuestions", "title difficulty category");

		if (!question) {
			return res
				.status(404)
				.json({ success: false, message: "Question not found" });
		}

		res.json({ success: true, data: question });
	} catch (error) {
		console.error("Get question for review error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Update Question Review Status (Approve/Reject)
export const updateQuestionReviewStatus = async (req, res) => {
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
		const { reviewStatus, comment } = req.body;
		const adminId = req.user.id;

		const question = await Question.findById(id);
		if (!question) {
			return res
				.status(404)
				.json({ success: false, message: "Question not found" });
		}

		// Update review status
		question.reviewStatus = reviewStatus;
		question.lastReviewedAt = new Date();

		// Add reviewer to the list if not already present
		if (!question.reviewers.includes(adminId)) {
			question.reviewers.push(adminId);
		}

		// Add review comment if provided
		if (comment) {
			question.reviewComments.push({
				reviewer: adminId,
				comment,
				date: new Date(),
			});
		}

		// If approved, change status to published and set verification
		if (reviewStatus === "approved") {
			question.status = "published";
			question.isVerified = true;
			question.verifiedBy = adminId;
			question.verifiedAt = new Date();
		}

		// If rejected, change status to draft
		if (reviewStatus === "rejected") {
			question.status = "draft";
		}

		await question.save();

		// Populate for response
		await question.populate("category", "name slug color");
		await question.populate("author", "name username");
		await question.populate("reviewers", "name username");
		await question.populate("reviewComments.reviewer", "name username");

		res.json({
			success: true,
			message: `Question ${reviewStatus} successfully`,
			data: { question },
		});
	} catch (error) {
		console.error("Update question review status error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Add Review Comment to Question
export const addReviewComment = async (req, res) => {
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
		const { comment } = req.body;
		const adminId = req.user.id;

		const question = await Question.findById(id);
		if (!question) {
			return res
				.status(404)
				.json({ success: false, message: "Question not found" });
		}

		// Add reviewer to the list if not already present
		if (!question.reviewers.includes(adminId)) {
			question.reviewers.push(adminId);
		}

		// Add review comment
		question.reviewComments.push({
			reviewer: adminId,
			comment,
			date: new Date(),
		});

		// Update review status to in_review if it was pending
		if (question.reviewStatus === "pending") {
			question.reviewStatus = "in_review";
		}

		await question.save();
		await question.populate("reviewComments.reviewer", "name username avatar");

		res.json({
			success: true,
			message: "Review comment added successfully",
			data: {
				reviewComments: question.reviewComments,
				reviewStatus: question.reviewStatus,
			},
		});
	} catch (error) {
		console.error("Add review comment error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Get Review Statistics for Admin Dashboard
export const getReviewStatistics = async (req, res) => {
	try {
		const [pending, inReview, approved, rejected, total] = await Promise.all([
			Question.countDocuments({ reviewStatus: "pending" }),
			Question.countDocuments({ reviewStatus: "in_review" }),
			Question.countDocuments({ reviewStatus: "approved" }),
			Question.countDocuments({ reviewStatus: "rejected" }),
			Question.countDocuments(),
		]);

		const recentReviews = await Question.find({
			reviewStatus: { $in: ["approved", "rejected"] },
		})
			.sort({ lastReviewedAt: -1 })
			.limit(10)
			.populate("category", "name slug color")
			.populate("author", "name username")
			.populate("verifiedBy", "name username")
			.select(
				"title reviewStatus lastReviewedAt verifiedBy category author slug"
			);

		res.json({
			success: true,
			data: {
				statistics: {
					pending,
					inReview,
					approved,
					rejected,
					total,
					approvalRate:
						approved + rejected > 0
							? ((approved / (approved + rejected)) * 100).toFixed(2)
							: 0,
				},
				recentReviews,
			},
		});
	} catch (error) {
		console.error("Get review statistics error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

