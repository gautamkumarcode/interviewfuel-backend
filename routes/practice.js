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
		body("settings.categories").optional(),
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

// Test AI evaluation endpoint
PracticeRouter.post("/test-ai", auth, async (req, res) => {
	try {
		const { evaluateAnswer } = await import("../utils/gemini.js");

		const testQA = [
			{
				question: "What is React?",
				userAnswer:
					"React is a JavaScript library for building user interfaces.",
				modelAnswer:
					"React is a JavaScript library for building user interfaces, particularly web applications.",
			},
		];

		console.log("🧪 Testing AI evaluation...");
		const result = await evaluateAnswer(testQA);

		res.json({
			success: true,
			message: "AI evaluation test completed",
			data: {
				result: result,
				hasApiKey: !!process.env.GEMINI_API_KEY,
				apiKeyLength: process.env.GEMINI_API_KEY?.length || 0,
				modelUsed: "gemini-1.5-pro",
			},
		});
	} catch (error) {
		console.error("AI test error:", error);
		res.status(500).json({
			success: false,
			message: "AI evaluation test failed",
			error: error.message,
		});
	}
});

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
