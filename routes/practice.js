import express from "express";
import { body } from "express-validator";
import {
	completeSession,
	createPracticeSession,
	getPracticeSessionById,
	getUserSessions,
	submitAnswer,
} from "../controller/practice-controller.js";
import auth from "../middleware/auth.js";

const PracticeRouter = express.Router();

PracticeRouter.post(
	"/sessions",
	auth,
	[
		body("settings.duration").optional().isInt({ min: 5, max: 180 }),
		body("settings.questionCount").optional().isInt({ min: 1, max: 50 }),
		body("settings.difficulty")
			.optional()
			.isIn(["Easy", "Medium", "Hard", "Mixed"]),
		body("settings.categories").optional().isArray(),
	],
	createPracticeSession
);

PracticeRouter.get("/sessions/:id", auth, getPracticeSessionById);

PracticeRouter.put(
	"/sessions/:id/answer",
	auth,
	[
		body("questionIndex").isInt({ min: 0 }),
		body("answer").trim().notEmpty(),
		body("timeSpent").optional().isInt({ min: 0 }),
	],
	submitAnswer
);

PracticeRouter.put("/sessions/:id/complete", auth, completeSession);

PracticeRouter.get("/sessions", auth, getUserSessions);

export default PracticeRouter;
