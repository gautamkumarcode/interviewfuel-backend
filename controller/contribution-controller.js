import { validationResult } from "express-validator";
import Contribution from "../models/Contribution.js";
import Question from "../models/Question.js";

// Submit a contribution
export const submitContribution = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				message: "Validation failed",
				errors: errors.array(),
			});
		}

		const { questionId } = req.params;
		const { type, content, description } = req.body;

		// Check if question exists
		const question = await Question.findById(questionId);
		if (!question) {
			return res.status(404).json({
				success: false,
				message: "Question not found",
			});
		}

		// Create contribution
		const contribution = new Contribution({
			question: questionId,
			contributor: req.user.id,
			type,
			content,
			description,
			status: "pending",
		});

		// Update question's contribution count and contributors list
		// Ensure contributors array stores entries consistently and avoid duplicates
		const contributorExists = question.contributors.some((c) =>
			c && c.user
				? c.user.toString() === req.user.id
				: c.toString() === req.user.id
		);

		if (!contributorExists) {
			const entry =
				question.contributors.length &&
				question.contributors[0] &&
				question.contributors[0].user !== undefined
					? {
							user: req.user.id,
							contribution: `Submitted ${type}`,
							contributedAt: new Date(),
					  }
					: req.user.id;

			question.contributors.push(entry);
		}

		// Bump contribution count and persist the question
		await question.save();
		await contribution.save();
		await contribution.populate("contributor", "name username avatar");

		res.status(201).json({
			success: true,
			message: "Contribution submitted successfully",
			data: { contribution },
		});
	} catch (err) {
		console.error("Submit contribution error:", err);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Get contributions for a question
export const getQuestionContributions = async (req, res) => {
	try {
		const { questionId } = req.params;
		const { status } = req.query;

		const query = { question: questionId };
		if (status) query.status = status;

		const contributions = await Contribution.find(query)
			.populate("contributor", "name username avatar")
			.populate("reviewedBy", "name username")
			.sort({ createdAt: -1 });

		res.json({
			success: true,
			data: { contributions, count: contributions.length },
		});
	} catch (err) {
		console.error("Get contributions error:", err);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Get user's contributions
export const getMyContributions = async (req, res) => {
	try {
		const contributions = await Contribution.find({
			contributor: req.user.id,
		})
			.populate("question", "title slug")
			.populate("reviewedBy", "name username")
			.sort({ createdAt: -1 });

		res.json({
			success: true,
			data: { contributions, count: contributions.length },
		});
	} catch (err) {
		console.error("Get my contributions error:", err);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Approve contribution
export const approveContribution = async (req, res) => {
	try {
		const { contributionId } = req.params;
		const { comment } = req.body;

		const contribution = await Contribution.findById(contributionId).populate(
			"question"
		);

		if (!contribution) {
			return res.status(404).json({
				success: false,
				message: "Contribution not found",
			});
		}

		// Check if user is author or admin
		const question = contribution.question;
		const isAuthor = question.author.toString() === req.user.id;
		const isAdmin = req.user.role === "admin";

		if (!isAuthor && !isAdmin) {
			return res.status(403).json({
				success: false,
				message: "Not authorized to approve this contribution",
			});
		}

		// Approve contribution
		await contribution.approve(req.user.id, comment);

		// Apply contribution to question
		await applyContributionToQuestion(contribution, question);

		// Add contributor to question's contributors list
		const contributorExists = question.contributors.some(
			(c) => c.user.toString() === contribution.contributor.toString()
		);

		if (!contributorExists) {
			question.contributors.push({
				user: contribution.contributor,
				contribution: `Added ${contribution.type}`,
				contributedAt: new Date(),
			});
			await question.save();
		}

		res.json({
			success: true,
			message: "Contribution approved and applied",
			data: { contribution },
		});
	} catch (err) {
		console.error("Approve contribution error:", err);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Reject contribution
export const rejectContribution = async (req, res) => {
	try {
		const { contributionId } = req.params;
		const { comment } = req.body;

		const contribution = await Contribution.findById(contributionId).populate(
			"question"
		);

		if (!contribution) {
			return res.status(404).json({
				success: false,
				message: "Contribution not found",
			});
		}

		// Check if user is author or admin
		const question = contribution.question;
		const isAuthor = question.author.toString() === req.user.id;
		const isAdmin = req.user.role === "admin";

		if (!isAuthor && !isAdmin) {
			return res.status(403).json({
				success: false,
				message: "Not authorized to reject this contribution",
			});
		}

		await contribution.reject(req.user.id, comment);

		res.json({
			success: true,
			message: "Contribution rejected",
			data: { contribution },
		});
	} catch (err) {
		console.error("Reject contribution error:", err);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Get pending contributions (for author/admin)
export const getPendingContributions = async (req, res) => {
	try {
		let query = { status: "pending" };

		// If not admin, only show contributions for user's questions
		if (req.user.role !== "admin") {
			const userQuestions = await Question.find({ author: req.user.id }).select(
				"_id"
			);
			const questionIds = userQuestions.map((q) => q._id);
			query.question = { $in: questionIds };
		}

		const contributions = await Contribution.find(query)
			.populate("contributor", "name username avatar")
			.populate("question", "title slug")
			.sort({ createdAt: -1 });

		res.json({
			success: true,
			data: { contributions, count: contributions.length },
		});
	} catch (err) {
		console.error("Get pending contributions error:", err);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Helper function to apply contribution to question
async function applyContributionToQuestion(contribution, question) {
	const { type, content } = contribution;

	switch (type) {
		case "solution":
			question.solutions.push(content.solution);
			break;

		case "hint":
			question.hints.push(content.hint);
			// Sort hints by order
			question.hints.sort((a, b) => a.order - b.order);
			break;

		case "explanation":
			question.richAnswer = content.explanation.richAnswer;
			break;

		case "bestPractice":
			question.bestPractices.push(content.bestPractice.practice);
			break;

		case "correction":
			// Apply correction based on field
			const field = content.correction.field;
			if (question[field] !== undefined) {
				question[field] = content.correction.newValue;
			}
			break;

		case "company":
			const existingCompany = question.companies.find(
				(c) => c.name === content.company.name
			);
			if (existingCompany) {
				existingCompany.frequency += content.company.frequency || 1;
			} else {
				question.companies.push(content.company);
			}
			break;
	}

	await question.save();
}

export default {
	submitContribution,
	getQuestionContributions,
	getMyContributions,
	approveContribution,
	rejectContribution,
	getPendingContributions,
};
