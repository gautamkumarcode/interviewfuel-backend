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
import PracticeSession from "../models/PracticeSession.js";

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
		body("answers")
			.isArray({ min: 1 })
			.withMessage("Answers array is required with at least one answer"),
		body("answers.*.questionIndex")
			.isInt({ min: 0 })
			.withMessage("Invalid question index"),
		body("answers.*.answer")
			.trim()
			.notEmpty()
			.withMessage("Answer cannot be empty"),
		body("answers.*.timeSpent")
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

// Share session (make it publicly accessible)
PracticeRouter.post(
	"/sessions/:id/share",
	auth,
	[param("id").isMongoId().withMessage("Invalid session ID")],
	async (req, res) => {
		try {
			const session = await PracticeSession.findById(req.params.id);

			if (!session) {
				return res.status(404).json({
					success: false,
					message: "Session not found",
				});
			}

			if (session.user.toString() !== req.user.id) {
				return res.status(403).json({
					success: false,
					message: "Not authorized",
				});
			}

			// For now, just return the share URL
			// In a full implementation, you might add a 'isPublic' field to the session
			const shareUrl = `${req.protocol}://${req.get("host")}/practice/shared/${
				session._id
			}`;

			res.json({
				success: true,
				message: "Session shared successfully",
				data: { shareUrl },
			});
		} catch (error) {
			console.error("Share session error:", error);
			res.status(500).json({
				success: false,
				message: "Failed to share session",
			});
		}
	}
);

export default PracticeRouter;
