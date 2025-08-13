import { validationResult } from "express-validator";
import PracticeSession from "../models/PracticeSession.js";
import Question from "../models/Question.js";
import User from "../models/User.js";
import Attempt from "../models/attempt.js";
import { evaluateAnswer, generateQuestions } from "../utils/gemini.js";

export const createPracticeSession = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				message: "Validation failed",
				errors: errors.array(),
			});
		}

		const { settings = {} } = req.body;
		const useAI = settings.source === "ai"; // flag to control AI mode

		let selectedQuestions = [];

		if (useAI) {
			const aiQuestions = await generateQuestions({
				topic: settings.topic || "Frontend",
				difficulty: settings.difficulty || "Medium",
				count: settings.questionCount || 5,
			});

			selectedQuestions = aiQuestions.map((q) => ({
				title: typeof q.title === "object" ? q.title.text : q.title,
				content: typeof q.content === "object" ? q.content.text : q.content,
				difficulty: settings.difficulty || "Mixed",
				timeLimit: q.timeLimit || 120,
				source: "ai",
			}));
		} else {
			const questionQuery = { status: "published" };

			if (settings.difficulty && settings.difficulty !== "Mixed")
				questionQuery.difficulty = settings.difficulty;

			if (settings.categories?.length > 0)
				questionQuery.category = { $in: settings.categories };

			let dbQuestions = await Question.find(questionQuery)
				.select("_id title difficulty category timeLimit")
				.populate("category", "name");

			if (settings.randomOrder !== false)
				dbQuestions = dbQuestions.sort(() => Math.random() - 0.5);

			const questionCount = Math.min(
				settings.questionCount || 5,
				dbQuestions.length
			);

			dbQuestions = dbQuestions.slice(0, questionCount);

			selectedQuestions = dbQuestions.map((q) => ({
				question: q._id,
				startedAt: new Date(),
			}));
		}

		// Create session
		const practiceSession = new PracticeSession({
			user: req.user.id,
			questions: useAI
				? selectedQuestions.map((q) => ({
						aiGenerated: true,
						...q,
						startedAt: new Date(),
				  }))
				: selectedQuestions,
			settings: {
				duration: settings.duration || 60,
				questionCount: selectedQuestions.length,
				difficulty: settings.difficulty || "Mixed",
				categories: settings.categories || [],
				includeTimer: settings.includeTimer !== false,
				randomOrder: settings.randomOrder !== false,
				source: useAI ? "ai" : "db",
				topic: settings.topic,
			},
		});

		await practiceSession.save();

		if (!useAI) {
			await practiceSession.populate(
				"questions.question",
				"title difficulty category timeLimit"
			);
		}

		res.status(201).json({
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
			return res.status(400).json({ success: false, errors: errors.array() });
		}

		const { answers } = req.body;
		const session = await PracticeSession.findById(req.params.id).populate(
			"questions.question",
			"title richAnswer content difficulty timeLimit"
		);

		if (!session)
			return res
				.status(404)
				.json({ success: false, message: "Session not found" });

		if (session.user.toString() !== req.user.id)
			return res
				.status(403)
				.json({ success: false, message: "Not authorized" });

		// 1. Build QA list for Gemini AI
		const qaList = answers.map(({ questionIndex, answer }) => {
			const sessionQuestion = session.questions[questionIndex];
			if (!sessionQuestion) {
				throw new Error(`Invalid question index: ${questionIndex}`);
			}

			// Handle AI-generated questions vs DB questions differently
			let questionObj;
			if (sessionQuestion.aiGenerated) {
				// For AI-generated questions, the question data is directly in the session
				questionObj = sessionQuestion;
			} else {
				// For DB questions, we need the populated question object
				questionObj = sessionQuestion.question;
				if (!questionObj) {
					throw new Error(`Question not found for index: ${questionIndex}`);
				}
			}

			return {
				question: questionObj.title,
				// For DB questions use richAnswer, for AI questions don't provide model answer
				modelAnswer: sessionQuestion.aiGenerated
					? undefined
					: questionObj.richAnswer || "No model answer provided",
				userAnswer: answer,
			};
		});

		console.log("QA List for evaluation:", JSON.stringify(qaList, null, 2));

		// 2. Get AI evaluation
		const aiResults = await evaluateAnswer(qaList);

		if (
			!aiResults ||
			!Array.isArray(aiResults) ||
			aiResults.length !== answers.length
		) {
			console.error("AI evaluation failed, providing fallback results");
			// Provide fallback results when AI evaluation fails
			const fallbackResults = answers.map(
				({ questionIndex, answer }, index) => ({
					question: qaList[index]?.question || "Unknown question",
					userAnswer: answer,
					isCorrect: false,
					feedback:
						"AI evaluation temporarily unavailable. Your answer has been recorded.",
					score: 5, // Neutral score when evaluation fails
				})
			);

			// Continue with saving the answers even if evaluation fails
			for (let i = 0; i < answers.length; i++) {
				const { questionIndex, answer, timeSpent } = answers[i];
				const sessionQuestion = session.questions[questionIndex];

				if (!sessionQuestion) continue;

				// Update session question
				session.questions[questionIndex] = {
					...(sessionQuestion._doc || sessionQuestion),
					answer,
					timeSpent: timeSpent || 0,
					completedAt: new Date(),
				};

				// For AI-generated questions, create a temporary question ID or handle differently
				const questionId = sessionQuestion.aiGenerated
					? sessionQuestion._id || `ai_${questionIndex}`
					: sessionQuestion.question._id;

				// Save to attempts with fallback data
				await Attempt.create({
					user: req.user.id,
					practiceSession: session._id,
					question: questionId,
					answer,
					score: fallbackResults[i].score,
					feedback: fallbackResults[i].feedback,
					notes: "AI evaluation failed",
					timeSpent,
				});
			}

			await session.save();

			return res.json({
				success: true,
				message: "Answers submitted (evaluation fallback applied)",
				data: fallbackResults,
			});
		}

		// 3. Save results to PracticeSession + Attempt
		for (let i = 0; i < answers.length; i++) {
			const { questionIndex, answer, timeSpent } = answers[i];
			const result = aiResults[i];
			const sessionQuestion = session.questions[questionIndex];

			if (!sessionQuestion) continue;

			// Update session question
			session.questions[questionIndex] = {
				...(sessionQuestion._doc || sessionQuestion),
				answer,
				timeSpent: timeSpent || 0,
				completedAt: new Date(),
			};

			// For AI-generated questions, create a temporary question ID or handle differently
			const questionId = sessionQuestion.aiGenerated
				? sessionQuestion._id || `ai_${questionIndex}`
				: sessionQuestion.question._id;

			// Save to attempts
			await Attempt.create({
				user: req.user.id,
				practiceSession: session._id,
				question: questionId,
				answer,
				score: result.score,
				feedback: result.feedback,
				notes: result.notes,
				timeSpent,
			});
		}

		await session.save();

		res.json({
			success: true,
			message: "Answers submitted and evaluated",
			data: aiResults,
		});
	} catch (error) {
		console.error("Submit answer error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// export const submitAnswer = async (req, res) => {
// 	try {
// 		const errors = validationResult(req);
// 		if (!errors.isEmpty()) {
// 			return res.status(400).json({ success: false, errors: errors.array() });
// 		}

// 		const { answers } = req.body; // [{ questionIndex: 0, answer: '...', timeSpent: 10 }, ...]
// 		const session = await PracticeSession.findById(req.params.id).populate(
// 			"questions.question"
// 		);

// 		if (!session)
// 			return res
// 				.status(404)
// 				.json({ success: false, message: "Session not found" });

// 		if (session.user.toString() !== req.user.id)
// 			return res
// 				.status(403)
// 				.json({ success: false, message: "Not authorized" });

// 		// 1. Build QA list for Gemini AI
// 		const qaList = answers.map(({ questionIndex, answer }) => {
// 			const questionObj = session.questions[questionIndex]?.question;
// 			if (!questionObj) {
// 				throw new Error(`Invalid question index: ${questionIndex}`);
// 			}
// 			return {
// 				question: questionObj.title,
// 				modelAnswer: questionObj.answerExplanation,
// 				userAnswer: answer,
// 			};
// 		});

// 		// 2. Get AI evaluation
// 		const aiResults = await evaluateAnswer(qaList); // returns [{ score, feedback, notes }, ...]

// 		if (
// 			!aiResults ||
// 			!Array.isArray(aiResults) ||
// 			aiResults.length !== answers.length
// 		) {
// 			return res.status(500).json({
// 				success: false,
// 				message: "AI evaluation failed or malformed.",
// 			});
// 		}

// 		// 3. Save results to PracticeSession + Attempt
// 		for (let i = 0; i < answers.length; i++) {
// 			const { questionIndex, answer, timeSpent } = answers[i];
// 			const result = aiResults[i];
// 			const questionItem = session.questions[questionIndex]?.question;

// 			if (!questionItem) continue;

// 			// Save inside session
// 			session.questions[questionIndex] = {
// 				...session.questions[questionIndex]._doc,
// 				answer,
// 				timeSpent: timeSpent || 0,
// 				completedAt: new Date(),
// 			};

// 			// Save to attempts
// 			await Attempt.create({
// 				user: req.user.id,
// 				practiceSession: session._id,
// 				question: questionItem._id,
// 				answer,
// 				score: result.score,
// 				feedback: result.feedback,
// 				notes: result.notes,
// 				timeSpent,
// 			});
// 		}

// 		await session.save();

// 		res.json({
// 			success: true,
// 			message: "Answers submitted and evaluated",
// 			data: aiResults,
// 		});
// 	} catch (error) {
// 		console.error("Submit answer error:", error);
// 		res.status(500).json({ success: false, message: "Server error" });
// 	}
// };

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
				results: sessions,
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
