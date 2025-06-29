import PracticeSession from "../models/PracticeSession.js";
import Question from "../models/Question.js";
import User from "../models/User.js";

// Dashboard analytics
export const getAnalyticsDashboard = async (req, res) => {
	try {
		const { timeframe = "30d" } = req.query;
		const days = parseInt(timeframe.replace("d", ""));
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);

		const sessions = await PracticeSession.find({
			user: req.user.id,
			status: "completed",
			completedAt: { $gte: startDate },
		}).populate("questions.question", "category difficulty");

		const performanceTrends = [];
		const dailyStats = {};
		const categoryStats = {};
		const hourlyActivity = new Array(24).fill(0);
		const weeklyActivity = new Array(7).fill(0);

		let totalSessions = 0;
		let totalQuestions = 0;
		let totalCorrect = 0;
		let totalTime = 0;

		sessions.forEach((session) => {
			// Daily stats
			const date = session.completedAt.toISOString().split("T")[0];
			if (!dailyStats[date]) {
				dailyStats[date] = {
					date,
					sessions: 0,
					questionsAnswered: 0,
					correctAnswers: 0,
					totalTime: 0,
				};
			}
			dailyStats[date].sessions++;
			dailyStats[date].questionsAnswered += session.results.answeredQuestions;
			dailyStats[date].correctAnswers += session.results.correctAnswers;
			dailyStats[date].totalTime += session.results.totalTimeSpent;

			// Category stats
			session.questions.forEach((q) => {
				if (q.question?.category) {
					const categoryId = q.question.category.toString();
					if (!categoryStats[categoryId]) {
						categoryStats[categoryId] = {
							attempted: 0,
							correct: 0,
							totalTime: 0,
						};
					}
					if (q.answer) {
						categoryStats[categoryId].attempted++;
						if (q.isCorrect) categoryStats[categoryId].correct++;
						categoryStats[categoryId].totalTime += q.timeSpent || 0;
					}
				}
			});

			// Hourly and weekly activity
			hourlyActivity[session.startedAt.getHours()]++;
			weeklyActivity[session.startedAt.getDay()]++;

			// Overall stats
			totalSessions++;
			totalQuestions += session.results.answeredQuestions;
			totalCorrect += session.results.correctAnswers;
			totalTime += session.results.totalTimeSpent;
		});

		Object.values(dailyStats).forEach((day) => {
			performanceTrends.push({
				date: day.date,
				completionRate:
					day.questionsAnswered > 0
						? (day.correctAnswers / day.questionsAnswered) * 100
						: 0,
				avgTime:
					day.questionsAnswered > 0
						? day.totalTime / day.questionsAnswered / 60
						: 0,
				questionsAnswered: day.questionsAnswered,
				sessions: day.sessions,
			});
		});

		performanceTrends.sort((a, b) => new Date(a.date) - new Date(b.date));

		const categoryAnalysis = await Promise.all(
			Object.entries(categoryStats).map(async ([categoryId, stats]) => {
				const category = await Question.findOne({ category: categoryId })
					.populate("category", "name")
					.select("category");

				return {
					category: category?.category?.name || "Unknown",
					attempted: stats.attempted,
					correct: stats.correct,
					accuracy:
						stats.attempted > 0
							? Math.round((stats.correct / stats.attempted) * 100)
							: 0,
					avgTime:
						stats.attempted > 0
							? Math.round((stats.totalTime / stats.attempted / 60) * 10) / 10
							: 0,
				};
			})
		);

		const overallStats = {
			totalSessions,
			totalQuestions,
			totalCorrect,
			overallAccuracy:
				totalQuestions > 0
					? Math.round((totalCorrect / totalQuestions) * 100)
					: 0,
			avgTimePerQuestion:
				totalQuestions > 0
					? Math.round((totalTime / totalQuestions / 60) * 10) / 10
					: 0,
			totalTimeSpent: Math.round((totalTime / 3600) * 10) / 10,
		};

		res.json({
			success: true,
			data: {
				performanceTrends,
				categoryAnalysis,
				activityPatterns: {
					hourly: hourlyActivity,
					weekly: weeklyActivity,
				},
				overallStats,
				timeframe,
			},
		});
	} catch (error) {
		console.error("Get analytics error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Leaderboard
export const getLeaderboard = async (req, res) => {
	try {
		const { timeframe = "30d", metric = "questionsAnswered" } = req.query;
		const days = parseInt(timeframe.replace("d", ""));
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);

		let sortField;
		switch (metric) {
			case "completionRate":
				sortField = "stats.completionRate";
				break;
			case "currentStreak":
				sortField = "stats.currentStreak";
				break;
			default:
				sortField = "stats.questionsAnswered";
		}

		const leaderboard = await User.find({
			isActive: true,
			"preferences.publicProfile": true,
		})
			.select("name username avatar stats")
			.sort({ [sortField]: -1 })
			.limit(50);

		const userRank =
			leaderboard.findIndex((user) => user._id.toString() === req.user.id) + 1;

		res.json({
			success: true,
			data: {
				leaderboard,
				userRank: userRank || null,
				metric,
				timeframe,
			},
		});
	} catch (error) {
		console.error("Get leaderboard error:", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};
