import { validationResult } from "express-validator";
import PracticeSession from "../models/PracticeSession.js";
import Question from "../models/Question.js";
import User from "../models/User.js";

export const createPracticeSession = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res
				.status(400)
				.json({
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				});
		}

		const { settings = {} } = req.body;
		const questionQuery = { status: "published" };

		if (settings.difficulty && settings.difficulty !== "Mixed")
			questionQuery.difficulty = settings.difficulty;

		if (settings.categories?.length > 0)
			questionQuery.category = { $in: settings.categories };

		let questions = await Question.find(questionQuery)
			.select("_id title difficulty category timeLimit")
			.populate("category", "name");

		if (settings.randomOrder !== false)
			questions = questions.sort(() => Math.random() - 0.5);

		const questionCount = Math.min(
			settings.questionCount || 5,
			questions.length
		);
		questions = questions.slice(0, questionCount);

		const practiceSession = new PracticeSession({
			user: req.user.id,
			questions: questions.map((q) => ({
				question: q._id,
				startedAt: new Date(),
			})),
			settings: {
				duration: settings.duration || 60,
				questionCount,
				difficulty: settings.difficulty || "Mixed",
				categories: settings.categories || [],
				includeTimer: settings.includeTimer !== false,
				randomOrder: settings.randomOrder !== false,
			},
		});

		await practiceSession.save();
		await practiceSession.populate(
			"questions.question",
			"title difficulty category timeLimit"
		);

		res
			.status(201)
			.json({
				success: true,
				message: "Practice session created",
				data: { session: practiceSession },
			});
	} catch (error) {
		console.error("Create session error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

export const getPracticeSessionById = async (req, res) => {
	try {
		const session = await PracticeSession.findById(req.params.id)
			.populate(
				"questions.question",
				"title content difficulty category timeLimit solutions hints"
			)
			.populate("questions.question.category", "name color");

		if (!session)
			return res
				.status(404)
				.json({ success: false, message: "Practice session not found" });

		if (session.user.toString() !== req.user.id)
			return res
				.status(403)
				.json({ success: false, message: "Not authorized" });

		res.json({ success: true, data: { session } });
	} catch (error) {
		console.error("Get session error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

export const submitAnswer = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res
				.status(400)
				.json({
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				});
		}

		const { questionIndex, answer, timeSpent, isCorrect } = req.body;
		const session = await PracticeSession.findById(req.params.id);

		if (!session)
			return res
				.status(404)
				.json({ success: false, message: "Session not found" });

		if (session.user.toString() !== req.user.id)
			return res
				.status(403)
				.json({ success: false, message: "Not authorized" });

		if (questionIndex >= session.questions.length)
			return res
				.status(400)
				.json({ success: false, message: "Invalid question index" });

		session.questions[questionIndex] = {
			...session.questions[questionIndex]._doc,
			answer,
			timeSpent: timeSpent || 0,
			isCorrect: isCorrect || false,
			completedAt: new Date(),
		};

		await session.save();
		res.json({ success: true, message: "Answer submitted", data: { session } });
	} catch (error) {
		console.error("Submit answer error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

export const completeSession = async (req, res) => {
	try {
		const session = await PracticeSession.findById(req.params.id);
		if (!session)
			return res
				.status(404)
				.json({ success: false, message: "Session not found" });

		if (session.user.toString() !== req.user.id)
			return res
				.status(403)
				.json({ success: false, message: "Not authorized" });

		await session.complete();

		const user = await User.findById(req.user.id);
		user.stats.totalSessions += 1;
		user.stats.questionsAnswered += session.results.answeredQuestions;

		user.stats.completionRate = Math.round(
			(user.stats.completionRate * (user.stats.totalSessions - 1) +
				session.results.completionRate) /
				user.stats.totalSessions
		);

		user.stats.averageTime =
			Math.round(
				((user.stats.averageTime * (user.stats.totalSessions - 1) +
					session.results.averageTimePerQuestion) /
					user.stats.totalSessions) *
					10
			) / 10;

		await user.save();

		res.json({
			success: true,
			message: "Session completed",
			data: { session },
		});
	} catch (error) {
		console.error("Complete session error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

export const getUserSessions = async (req, res) => {
	try {
		const { page = 1, limit = 10, status } = req.query;
		const query = { user: req.user.id };
		if (status) query.status = status;

		const sessions = await PracticeSession.find(query)
			.sort({ createdAt: -1 })
			.limit(limit * 1)
			.skip((page - 1) * limit)
			.populate("settings.categories", "name color")
			.select("-questions.answer");

		const total = await PracticeSession.countDocuments(query);

		res.json({
			success: true,
			data: {
				sessions,
				pagination: {
					current: Number(page),
					pages: Math.ceil(total / limit),
					total,
					limit: Number(limit),
				},
			},
		});
	} catch (error) {
		console.error("Get sessions error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};
