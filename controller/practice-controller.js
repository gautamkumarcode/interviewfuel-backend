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
				const startTime = Date.now();

				// Determine topic for AI generation
				let topic = "Frontend Development"; // default topic
				let topicSource = "default";

				// Priority 1: Custom topic (user input)
				if (settings.customTopic?.trim()) {
					topic = settings.customTopic.trim();
					topicSource = "custom";
				}
				// Priority 2: Category from database
				else if (settings.categories?.length > 0) {
					try {
						const Category = (await import("../models/Category.js")).default;
						const category = await Category.findById(settings.categories[0]);
						if (category) {
							topic = category.name;
							topicSource = "category";
						}
					} catch (error) {
						console.warn("Failed to fetch category for AI topic:", error);
					}
				}

				// Calculate intelligent time distribution
				const totalSessionMinutes = settings.duration || 60;
				const questionCount = settings.questionCount || 5;
				const calculatedTimePerQuestion = Math.floor(
					(totalSessionMinutes * 60) / questionCount
				);

				const aiQuestions = await generateQuestions({
					topic: topic, // Use the determined topic (custom or category)
					difficulty: settings.difficulty || "Medium",
					count: questionCount,
					sessionDuration: totalSessionMinutes,
					calculatedTimePerQuestion: calculatedTimePerQuestion,
					isCustomTopic: topicSource === "custom",
				});

				const generationTime = Date.now() - startTime;
				console.log(`AI questions generated in ${generationTime}ms`);

				// Ensure time limits add up to total session duration
				const totalSessionSeconds = totalSessionMinutes * 60;
				let totalQuestionTime = 0;

				// First pass: collect AI-generated times
				const questionsWithTime = aiQuestions.map((q, index) => {
					const questionTime = q.timeLimit || calculatedTimePerQuestion;
					totalQuestionTime += questionTime;
					return {
						aiGenerated: true,
						title: typeof q.title === "object" ? q.title.text : q.title,
						content: typeof q.content === "object" ? q.content.text : q.content,
						difficulty: settings.difficulty || "Medium",
						timeLimit: questionTime,
						source: "ai",
						startedAt: new Date(),
					};
				});

				// Adjust times to match session duration exactly
				if (totalQuestionTime !== totalSessionSeconds) {
					const timeDifference = totalSessionSeconds - totalQuestionTime;
					const adjustmentPerQuestion = Math.floor(
						timeDifference / questionCount
					);
					const remainder = timeDifference % questionCount;

					questionsWithTime.forEach((q, index) => {
						q.timeLimit += adjustmentPerQuestion;
						// Distribute remainder to first few questions
						if (index < remainder) {
							q.timeLimit += 1;
						}
						// Ensure minimum 60 seconds per question
						q.timeLimit = Math.max(60, q.timeLimit);
					});
				}

				selectedQuestions = questionsWithTime;
			} catch (aiError) {
				return res.status(500).json({
					success: false,
					message:
						aiError.message ||
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

			// Apply smart time distribution to database questions too
			const totalSessionMinutes = settings.duration || 60;
			const totalSessionSeconds = totalSessionMinutes * 60;
			const calculatedTimePerQuestion = Math.floor(
				totalSessionSeconds / questionCount
			);

			selectedQuestions = dbQuestions
				.slice(0, questionCount)
				.map((q, index) => ({
					question: q._id,
					aiGenerated: false,
					title: q.title,
					content: q.content,
					difficulty: q.difficulty,
					timeLimit: calculatedTimePerQuestion, // Use calculated time instead of database time
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
				console.log(`Attempting AI evaluation for ${qaList.length} answers...`);
				aiResults = await evaluateAnswer(qaList);

				if (aiResults) {
					console.log(
						`✅ AI evaluation successful: ${aiResults.length} results`
					);
				} else {
					console.warn("⚠️ AI evaluation returned null, using fallback");
				}
			}
		} catch (error) {
			console.error("❌ AI evaluation error:", error);
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

			// Create attempt record for both database and AI-generated questions
			try {
				const attemptData = {
					user: req.user.id,
					practiceSession: session._id,
					answer,
					score: evaluation.score,
					feedback: evaluation.feedback,
					notes: evaluation.notes,
					timeSpent,
				};

				if (sessionQuestion.aiGenerated) {
					// For AI-generated questions
					attemptData.questionType = "ai";
					attemptData.aiQuestionData = {
						title: sessionQuestion.title,
						content: sessionQuestion.content,
						difficulty: sessionQuestion.difficulty,
					};
				} else {
					// For database questions
					attemptData.questionType = "database";
					attemptData.question = sessionQuestion.question._id;
				}

				await Attempt.create(attemptData);
				console.log(
					`✅ Attempt created for ${
						sessionQuestion.aiGenerated ? "AI" : "database"
					} question at index ${questionIndex}`
				);
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
