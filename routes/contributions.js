import express from "express";
import { body } from "express-validator";
import {
	approveContribution,
	getMyContributions,
	getPendingContributions,
	getQuestionContributions,
	rejectContribution,
	submitContribution,
} from "../controller/contribution-controller.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Submit a contribution to a question
router.post(
	"/questions/:questionId/contribute",
	auth,
	[
		body("type")
			.isIn([
				"solution",
				"hint",
				"explanation",
				"bestPractice",
				"correction",
				"company",
			])
			.withMessage("Invalid contribution type"),
		body("content").notEmpty().withMessage("Content is required"),
		body("description")
			.isLength({ min: 10, max: 500 })
			.withMessage("Description must be between 10 and 500 characters"),
	],
	submitContribution
);

// Get contributions for a question
router.get("/questions/:questionId/contributions", getQuestionContributions);

// Get user's contributions
router.get("/contributions/my-contributions", auth, getMyContributions);

// Get pending contributions (for author/admin)
router.get("/contributions/pending", auth, getPendingContributions);

// Approve a contribution
router.patch(
	"/contributions/:contributionId/approve",
	auth,
	[body("comment").optional().isString()],
	approveContribution
);

// Reject a contribution
router.patch(
	"/contributions/:contributionId/reject",
	auth,
	[body("comment").notEmpty().withMessage("Rejection reason is required")],
	rejectContribution
);

export default router;
