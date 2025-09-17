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
		const useAI = settings.source === "ai";
		let selectedQuestions = [];

		if (useAI) {
			// Generate AI questions
			try {
				const aiQuestions = await generateQuestions({
					topic: settings.topic || "Frontend Development",
					difficulty: settings.difficulty || "Medium",
					count: settings.questionCount || 5,
				});

				selectedQuestions = aiQuestions.map((q, index) => ({
					aiGenerated: true,
					title: typeof q.title === "object" ? q.title.text : q.title,
					content: typeof q.content === "object" ? q.content.text : q.content,
					difficulty: settings.difficulty || "Medium",
					timeLimit: q.timeLimit || 120,
					source: "ai",
					startedAt: new Date(),
				}));
			} catch (aiError) {
				console.error("AI question generation failed:", aiError);
				return res.status(500).json({
					success: false,
					message:
						"Failed to generate AI questions. Please try again or use database questions.",
				});
			}
		} else {
			// Use database questions
			const questionQuery = { status: "published" };

			if (settings.difficulty && settings.difficulty !== "Mixed") {
				questionQuery.difficulty = settings.difficulty;
			}

			if (settings.categories?.length > 0) {
				questionQuery.category = { $in: settings.categories };
			}

			let dbQuestions = await Question.find(questionQuery)
				.select("_id title content difficulty category timeLimit")
				.populate("category", "name");

			if (dbQuestions.length === 0) {
				return res.status(400).json({
					success: false,
					message:
						"No questions found matching your criteria. Please adjust your settings.",
				});
			}

			if (settings.randomOrder !== false) {
				dbQuestions = dbQuestions.sort(() => Math.random() - 0.5);
			}

			const questionCount = Math.min(
				settings.questionCount || 5,
				dbQuestions.length
			);

			selectedQuestions = dbQuestions.slice(0, questionCount).map((q) => ({
				question: q._id,
				aiGenerated: false,
				title: q.title,
				content: q.content,
				difficulty: q.difficulty,
				timeLimit: q.timeLimit || 120,
				source: "db",
				startedAt: new Date(),
			}));
		}

		// Create practice session
		const practiceSession = new PracticeSession({
			user: req.user.id,
			title: `${useAI ? "AI" : "Database"} Practice Session`,
			questions: selectedQuestions,
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
			status: "active",
		});

		await practiceSession.save();

		// Populate database questions if needed
		if (!useAI) {
			await practiceSession.populate(
				"questions.question",
				"title content difficulty category timeLimit"
			);
		}

		res.status(201).json({
			success: true,
			message: "Practice session created successfully",
			data: { session: practiceSession },
		});
	} catch (error) {
		console.error("Create session error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to create practice session",
		});
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
			return res.status(400).json({
				success: false,
				message: "Validation failed",
				errors: errors.array(),
			});
		}

		const { answers } = req.body;
		const session = await PracticeSession.findById(req.params.id).populate(
			"questions.question",
			"title richAnswer content difficulty timeLimit"
		);

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

		// Build QA list for AI evaluation
		const qaList = [];
		const processedAnswers = [];

		for (const { questionIndex, answer, timeSpent } of answers) {
			const sessionQuestion = session.questions[questionIndex];
			if (!sessionQuestion) {
				console.warn(`Invalid question index: ${questionIndex}`);
				continue;
			}

			// Get question data based on source
			let questionData;
			if (sessionQuestion.aiGenerated) {
				questionData = {
					title: sessionQuestion.title,
					content: sessionQuestion.content,
					richAnswer: null, // AI questions don't have model answers
				};
			} else {
				questionData = sessionQuestion.question;
				if (!questionData) {
					console.warn(`Question not found for index: ${questionIndex}`);
					continue;
				}
			}

			// Add to QA list for evaluation
			qaList.push({
				question: questionData.title,
				modelAnswer: questionData.richAnswer || undefined,
				userAnswer: answer,
			});

			// Store processed answer data
			processedAnswers.push({
				questionIndex,
				answer,
				timeSpent: timeSpent || 0,
				sessionQuestion,
				questionData,
			});
		}

		// Get AI evaluation with fallback handling
		let aiResults = null;
		try {
			if (qaList.length > 0) {
				aiResults = await evaluateAnswer(qaList);
			}
		} catch (error) {
			console.error("AI evaluation error:", error);
		}

		// Create fallback results if AI evaluation failed
		if (
			!aiResults ||
			!Array.isArray(aiResults) ||
			aiResults.length !== qaList.length
		) {
			console.warn(
				"AI evaluation failed or returned invalid results, using fallback"
			);
			aiResults = qaList.map((qa, index) => ({
				question: qa.question,
				userAnswer: qa.userAnswer,
				isCorrect: false,
				feedback:
					"AI evaluation temporarily unavailable. Your answer has been recorded.",
				score: 5, // Neutral score
				notes: "Fallback evaluation",
			}));
		}

		// Save results to session and create attempts
		for (let i = 0; i < processedAnswers.length; i++) {
			const { questionIndex, answer, timeSpent, sessionQuestion } =
				processedAnswers[i];
			const evaluation = aiResults[i] || {
				isCorrect: false,
				score: 5,
				feedback: "Evaluation unavailable",
				notes: "Fallback",
			};

			// Update session question
			session.questions[questionIndex].answer = answer;
			session.questions[questionIndex].timeSpent = timeSpent;
			session.questions[questionIndex].completedAt = new Date();
			session.questions[questionIndex].score = evaluation.score;
			session.questions[questionIndex].isCorrect = evaluation.isCorrect;
			session.questions[questionIndex].feedback = evaluation.feedback || "";
			session.questions[questionIndex].notes = evaluation.notes || "";

			// Create attempt record
			const questionId = sessionQuestion.aiGenerated
				? `ai_${sessionQuestion._id || questionIndex}`
				: sessionQuestion.question._id;

			try {
				await Attempt.create({
					user: req.user.id,
					practiceSession: session._id,
					question: questionId,
					answer,
					score: evaluation.score,
					feedback: evaluation.feedback,
					notes: evaluation.notes,
					timeSpent,
				});
			} catch (attemptError) {
				console.error("Failed to create attempt:", attemptError);
				// Continue processing other answers even if one attempt fails
			}
		}

		// Save session with all updates
		session.markModified("questions");
		await session.save();

		res.json({
			success: true,
			message: "Answers submitted and evaluated successfully",
			data: aiResults,
		});
	} catch (error) {
		console.error("Submit answer error:", error);
		res.status(500).json({
			success: false,
			message: "Server error occurred while processing answers",
		});
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

		// Prevent completing an already completed session
		if (session.status === "completed") {
			return res.json({
				success: true,
				message: "Session already completed",
				data: { session },
			});
		}

		// Complete the session and calculate results
		await session.complete();

		// Update user statistics
		try {
			const user = await User.findById(req.user.id);
			if (user && user.stats) {
				const currentSessions = user.stats.totalSessions || 0;
				const newSessionCount = currentSessions + 1;

				user.stats.totalSessions = newSessionCount;
				user.stats.questionsAnswered =
					(user.stats.questionsAnswered || 0) +
					session.results.answeredQuestions;

				// Calculate weighted averages
				const currentCompletionRate = user.stats.completionRate || 0;
				user.stats.completionRate = Math.round(
					(currentCompletionRate * currentSessions +
						session.results.completionRate) /
						newSessionCount
				);

				const currentAvgTime = user.stats.averageTime || 0;
				user.stats.averageTime =
					Math.round(
						((currentAvgTime * currentSessions +
							session.results.averageTimePerQuestion) /
							newSessionCount) *
							10
					) / 10;

				await user.save();
			}
		} catch (userUpdateError) {
			console.error("Failed to update user stats:", userUpdateError);
			// Don't fail the session completion if user stats update fails
		}

		res.json({
			success: true,
			message: "Session completed successfully",
			data: {
				session,
				finalResults: session.results,
			},
		});
	} catch (error) {
		console.error("Complete session error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to complete session",
		});
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
