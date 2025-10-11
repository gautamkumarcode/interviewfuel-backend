import express from "express";
import { body, query } from "express-validator";
import { auth } from "../middleware/auth.js";
import optionalAuth from "../middleware/optionalAuth.js";

import {
	bookmarkQuestion,
	createMultipleQuestions,
	createQuestion,
	deleteQuestion,
	getPopularQuestions,
	getQuestions,
	getSingleQuestion,
	likeQuestion,
	updateQuestion,
} from "../controller/questions-controller.js";

const QuestionsRouter = express.Router();

QuestionsRouter.get(
	"/",
	[
		query("page").optional().isInt({ min: 1 }),
		query("limit").optional().isInt({ min: 1, max: 100 }),
		query("difficulty").optional().isIn(["Easy", "Medium", "Hard"]),
		query("category").optional().isMongoId(),
		query("search").optional().trim().isLength({ min: 1, max: 100 }),
	],
	getQuestions
);

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

export default QuestionsRouter;
