import express from "express";
import { body, query } from "express-validator";
import { adminAuth } from "../middleware/adminAuth.js";
import { auth } from "../middleware/auth.js";
import optionalAuth from "../middleware/optionalAuth.js";

import {
	addComment,
	addReviewComment,
	bookmarkQuestion,
	createMultipleQuestions,
	createQuestion,
	deleteComment,
	deleteQuestion,
	editComment,
	getBookmarkedQuestions,
	getComments,
	getLikedQuestions,
	getMyQuestions,
	getPendingQuestions,
	getPopularQuestions,
	getQuestionForReview,
	getQuestions,
	getRelatedQuestions,
	getReviewStatistics,
	getSingleQuestion,
	likeComment,
	likeQuestion,
	setRelatedQuestions,
	updateQuestion,
	updateQuestionReviewStatus,
} from "../controller/questions-controller.js";

const QuestionsRouter = express.Router();

QuestionsRouter.get(
	"/",
	[
		query("page").optional().isInt({ min: 1 }),
		query("limit").optional().isInt({ min: 1, max: 100 }),
		query("difficulty").optional().isIn(["Easy", "Medium", "Hard"]),
		query("category").optional(),
		query("search").optional().trim().isLength({ min: 1, max: 100 }),
	],
	getQuestions
);

QuestionsRouter.get("/my-bookmarks", auth, getBookmarkedQuestions);
QuestionsRouter.get("/my-likes", auth, getLikedQuestions);
QuestionsRouter.get("/my-questions", auth, getMyQuestions);

QuestionsRouter.get("/popular", getPopularQuestions);
QuestionsRouter.get("/:id", optionalAuth, getSingleQuestion);

QuestionsRouter.post(
	"/",
	auth,
	[
		body("title").trim().isLength({ min: 10, max: 200 }),
		body("content").trim().isLength({ min: 50 }),
		body("category").isMongoId(),
		body("difficulty").isIn(["Easy", "Medium", "Hard"]),
		body("tags").optional().isArray(),
		body("timeLimit").optional().isInt({ min: 1, max: 180 }),
	],
	createQuestion
);

QuestionsRouter.put(
	"/:id",
	auth,
	[
		body("title").optional().trim().isLength({ min: 10, max: 200 }),
		body("content").optional().trim().isLength({ min: 50 }),
		body("category").optional().isMongoId(),
		body("difficulty").optional().isIn(["Easy", "Medium", "Hard"]),
	],
	updateQuestion
);

// Comment routes
QuestionsRouter.get("/:questionId/comments", optionalAuth, getComments);
QuestionsRouter.post("/:questionId/comments/add", auth, addComment);
QuestionsRouter.post(
	"/:questionId/comments/:commentId/like",
	auth,
	likeComment
);
QuestionsRouter.put(
	"/:questionId/comments/:commentId",
	auth,
	[body("content").trim().isLength({ min: 1, max: 1000 })],
	editComment
);
QuestionsRouter.delete("/:questionId/comments/:commentId", auth, deleteComment);

// Related questions routes
QuestionsRouter.get("/:questionId/related", getRelatedQuestions);
QuestionsRouter.put(
	"/:questionId/related",
	auth,
	[body("relatedQuestionIds").optional().isArray()],
	setRelatedQuestions
);

QuestionsRouter.post(
	"/bulk",
	auth,
	[
		body().isArray({ min: 1 }),
		body("*.title").trim().isLength({ min: 10, max: 200 }),
		body("*.content").trim().isLength({ min: 10 }),
		body("*.category").isMongoId(),
		body("*.difficulty").isIn(["Easy", "Medium", "Hard"]),
		body("*.tags").optional().isArray(),
		body("*.timeLimit").optional().isInt({ min: 1, max: 180 }),
	],
	createMultipleQuestions
);

QuestionsRouter.delete("/:id", auth, deleteQuestion);
QuestionsRouter.post("/:id/like", auth, likeQuestion);
QuestionsRouter.post("/:id/bookmark", auth, bookmarkQuestion);

// Admin Review Routes
QuestionsRouter.get("/admin/pending", auth, adminAuth, getPendingQuestions);
QuestionsRouter.get(
	"/admin/review-stats",
	auth,
	adminAuth,
	getReviewStatistics
);
QuestionsRouter.get("/admin/review/:id", auth, adminAuth, getQuestionForReview);
QuestionsRouter.put(
	"/admin/review/:id/status",
	auth,
	adminAuth,
	[
		body("reviewStatus")
			.isIn(["pending", "in_review", "approved", "rejected"])
			.withMessage("Invalid review status"),
		body("comment")
			.optional()
			.trim()
			.isLength({ min: 1, max: 500 })
			.withMessage("Comment must be between 1 and 500 characters"),
	],
	updateQuestionReviewStatus
);
QuestionsRouter.post(
	"/admin/review/:id/comment",
	auth,
	adminAuth,
	[
		body("comment")
			.trim()
			.isLength({ min: 1, max: 500 })
			.withMessage("Comment must be between 1 and 500 characters"),
	],
	addReviewComment
);

export default QuestionsRouter;
