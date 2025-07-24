import express from "express";
import { body, param } from "express-validator";
import {
	completeSession,
	createPracticeSession,
	getPracticeSessionById,
	getUserSessions,
	submitAnswer,
} from "../controller/practice-controller.js";
import { auth } from "../middleware/auth.js";

const PracticeRouter = express.Router();

// Create new practice session
PracticeRouter.post(
	"/sessions/create",
	auth,
	[
		body("settings.duration")
			.optional()
			.isInt({ min: 5, max: 180 })
			.withMessage("Duration must be between 5 and 180 minutes"),
		body("settings.questionCount")
			.optional()
			.isInt({ min: 1, max: 50 })
			.withMessage("Question count must be between 1 and 50"),
		body("settings.difficulty")
			.optional()
			.isIn(["Easy", "Medium", "Hard", "Mixed"])
			.withMessage("Invalid difficulty level"),
		body("settings.categories")
			.optional()
			.isArray({ min: 1 })
			.withMessage("Categories should be an array of category IDs"),
	],
	createPracticeSession
);

// Get session by ID
PracticeRouter.get(
	"/sessions/:id",
	auth,
	[param("id").isMongoId().withMessage("Invalid session ID")],
	getPracticeSessionById
);

// Submit answer to a question
PracticeRouter.put(
	"/sessions/:id/answer",
	auth,
	[
		param("id").isMongoId().withMessage("Invalid session ID"),
		body("questionIndex")
			.isInt({ min: 0 })
			.withMessage("Invalid question index"),
		body("answer").trim().notEmpty().withMessage("Answer cannot be empty"),
		body("timeSpent")
			.optional()
			.isInt({ min: 0 })
			.withMessage("Invalid time spent"),
	],
	submitAnswer
);

// Mark session as complete
PracticeRouter.put(
	"/sessions/:id/complete",
	auth,
	[param("id").isMongoId().withMessage("Invalid session ID")],
	completeSession
);

// Get all sessions of logged-in user
PracticeRouter.get("/sessions", auth, getUserSessions);

export default PracticeRouter;
