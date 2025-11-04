import Category from "../models/Category.js";
import PracticeSession from "../models/PracticeSession.js";
import User from "../models/User.js";

// @desc    Get user analytics dashboard data
// @route   GET /api/analytics/dashboard
// @access  Private
export const getDashboardAnalytics = async (req, res) => {
	try {
		const userId = req.user.id;
		const { timeRange = "30" } = req.query; // days

		const startDate = new Date();
		startDate.setDate(startDate.getDate() - parseInt(timeRange));

		// Get user profile with stats and achievements
		const user = await User.findById(userId)
			.select("stats achievements")
			.populate("achievements.achievementId", "title description icon rarity");

		// Get practice sessions within time range
		const practiceSessions = await PracticeSession.find({
			user: userId,
			status: "completed",
			completedAt: { $gte: startDate },
		})
			.populate("settings.categories", "name")
			.sort({ completedAt: -1 });

		// Calculate aggregated metrics
		const totalQuestions = practiceSessions.reduce(
			(sum, session) => sum + session.results.totalQuestions,
			0
		);
		const totalCorrect = practiceSessions.reduce(
			(sum, session) => sum + session.results.correctAnswers,
			0
		);
		const totalPracticeTime = practiceSessions.reduce(
			(sum, session) => sum + Math.round(session.results.totalTimeSpent / 60), // convert to minutes
			0
		);
		const accuracy =
			totalQuestions > 0
				? ((totalCorrect / totalQuestions) * 100).toFixed(1)
				: 0;

		// Category performance analysis
		const categoryPerformance = {};
		practiceSessions.forEach((session) => {
			session.questions.forEach((q) => {
				// Get category from question or session settings
				const categoryName = session.settings.categories[0]?.name || "General";

				if (!categoryPerformance[categoryName]) {
					categoryPerformance[categoryName] = {
						name: categoryName,
						attempted: 0,
						correct: 0,
						averageTime: 0,
						accuracy: 0,
						totalTime: 0,
						sessionCount: 0,
					};
				}

				categoryPerformance[categoryName].attempted += 1;
				if (q.isCorrect) categoryPerformance[categoryName].correct += 1;
				categoryPerformance[categoryName].totalTime += q.timeSpent || 0;
				categoryPerformance[categoryName].sessionCount += 1;
			});
		});

		// Calculate accuracy and average time for each category
		Object.keys(categoryPerformance).forEach((catName) => {
			const cat = categoryPerformance[catName];
			cat.accuracy =
				cat.attempted > 0
					? ((cat.correct / cat.attempted) * 100).toFixed(1)
					: 0;
			cat.averageTime =
				cat.sessionCount > 0 ? Math.round(cat.totalTime / cat.sessionCount) : 0;
		});

		// Difficulty breakdown analysis
		const difficultyStats = {
			easy: { attempted: 0, correct: 0, accuracy: 0 },
			medium: { attempted: 0, correct: 0, accuracy: 0 },
			hard: { attempted: 0, correct: 0, accuracy: 0 },
		};

		practiceSessions.forEach((session) => {
			session.questions.forEach((q) => {
				const difficulty = q.difficulty?.toLowerCase() || "medium";
				if (difficultyStats[difficulty]) {
					difficultyStats[difficulty].attempted += 1;
					if (q.isCorrect) difficultyStats[difficulty].correct += 1;
				}
			});
		});

		// Calculate accuracy for each difficulty
		Object.keys(difficultyStats).forEach((level) => {
			const diff = difficultyStats[level];
			diff.accuracy =
				diff.attempted > 0
					? ((diff.correct / diff.attempted) * 100).toFixed(1)
					: 0;
		});

		// Recent activity (last 7 sessions for chart)
		const recentSessions = practiceSessions.slice(0, 7).reverse();
		const recentActivity = recentSessions.map((session) => ({
			date: session.completedAt.toISOString().split("T")[0],
			questionsAnswered: session.results.totalQuestions,
			practiceTime: Math.round(session.results.totalTimeSpent / 60), // minutes
			accuracy: session.results.accuracy,
			correctAnswers: session.results.correctAnswers,
		}));

		// Weekly comparison for growth calculation
		const thisWeekStart = new Date();
		thisWeekStart.setDate(thisWeekStart.getDate() - 7);
		const lastWeekStart = new Date();
		lastWeekStart.setDate(lastWeekStart.getDate() - 14);

		const thisWeekSessions = practiceSessions.filter(
			(session) => session.completedAt >= thisWeekStart
		);
		const lastWeekSessions = practiceSessions.filter(
			(session) =>
				session.completedAt >= lastWeekStart &&
				session.completedAt < thisWeekStart
		);

		const thisWeekQuestions = thisWeekSessions.reduce(
			(sum, session) => sum + session.results.totalQuestions,
			0
		);
		const lastWeekQuestions = lastWeekSessions.reduce(
			(sum, session) => sum + session.results.totalQuestions,
			0
		);

		const weeklyGrowth =
			lastWeekQuestions > 0
				? (
						((thisWeekQuestions - lastWeekQuestions) / lastWeekQuestions) *
						100
				  ).toFixed(1)
				: 0;

		res.json({
			success: true,
			data: {
				overview: {
					totalQuestions,
					totalCorrect,
					totalPracticeTime,
					accuracy: parseFloat(accuracy),
					currentStreak: user?.stats?.currentStreak || 0,
					longestStreak: user?.stats?.longestStreak || 0,
					weeklyGrowth: parseFloat(weeklyGrowth),
				},
				categoryPerformance: Object.values(categoryPerformance),
				difficultyStats,
				recentActivity,
				achievements: user?.achievements || [],
				timeRange: parseInt(timeRange),
			},
		});
	} catch (error) {
		console.error("Get dashboard analytics error:", error);
		res.status(500).json({
			success: false,
			message: "Server error",
		});
	}
};

// @desc    Get detailed performance analytics
// @route   GET /api/analytics/performance
// @access  Private
export const getPerformanceAnalytics = async (req, res) => {
	try {
		const userId = req.user.id;
		const { category, difficulty, timeRange = "30" } = req.query;

		const startDate = new Date();
		startDate.setDate(startDate.getDate() - parseInt(timeRange));

		let matchConditions = {
			user: userId,
			status: "completed",
			completedAt: { $gte: startDate },
		};

		// Add category filter if specified
		if (category) {
			const categoryDoc = await Category.findOne({ name: category });
			if (categoryDoc) {
				matchConditions["settings.categories"] = categoryDoc._id;
			}
		}

		const practiceSessions = await PracticeSession.find(matchConditions).sort({
			completedAt: -1,
		});

		// Filter by difficulty if specified
		let filteredSessions = practiceSessions;
		if (difficulty) {
			filteredSessions = practiceSessions.filter((session) =>
				session.questions.some((q) => q.difficulty === difficulty)
			);
		}

		// Calculate performance trends
		const performanceTrend = filteredSessions.map((session) => ({
			date: session.completedAt.toISOString().split("T")[0],
			accuracy: session.results.accuracy,
			questionsAnswered: session.results.totalQuestions,
			practiceTime: Math.round(session.results.totalTimeSpent / 60),
		}));

		// Calculate improvement metrics
		const firstHalf = filteredSessions.slice(
			Math.floor(filteredSessions.length / 2)
		);
		const secondHalf = filteredSessions.slice(
			0,
			Math.floor(filteredSessions.length / 2)
		);

		const firstHalfAccuracy =
			firstHalf.length > 0
				? firstHalf.reduce(
						(sum, session) => sum + session.results.accuracy,
						0
				  ) / firstHalf.length
				: 0;

		const secondHalfAccuracy =
			secondHalf.length > 0
				? secondHalf.reduce(
						(sum, session) => sum + session.results.accuracy,
						0
				  ) / secondHalf.length
				: 0;

		const improvement = (secondHalfAccuracy - firstHalfAccuracy).toFixed(1);

		res.json({
			success: true,
			data: {
				performanceTrend,
				totalDays: filteredSessions.length,
				improvement: parseFloat(improvement),
				filters: { category, difficulty, timeRange },
			},
		});
	} catch (error) {
		console.error("Get performance analytics error:", error);
		res.status(500).json({
			success: false,
			message: "Server error",
		});
	}
};

// @desc    Get AI insights for user performance
// @route   GET /api/analytics/insights
// @access  Private
export const getAIInsights = async (req, res) => {
	try {
		const userId = req.user.id;
		const { timeRange = "30" } = req.query;

		const startDate = new Date();
		startDate.setDate(startDate.getDate() - parseInt(timeRange));

		// Get practice sessions and user data
		const practiceSessions = await PracticeSession.find({
			user: userId,
			status: "completed",
			completedAt: { $gte: startDate },
		})
			.populate("settings.categories", "name")
			.sort({ completedAt: -1 });

		const user = await User.findById(userId).select("stats");

		// Generate insights based on performance data
		const insights = [];

		// Calculate overall metrics
		const totalQuestions = practiceSessions.reduce(
			(sum, session) => sum + session.results.totalQuestions,
			0
		);
		const totalCorrect = practiceSessions.reduce(
			(sum, session) => sum + session.results.correctAnswers,
			0
		);
		const overallAccuracy =
			totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

		// Performance trend analysis
		if (practiceSessions.length >= 7) {
			const recentWeek = practiceSessions.slice(0, 7);
			const previousWeek = practiceSessions.slice(7, 14);

			const recentAccuracy =
				recentWeek.length > 0
					? recentWeek.reduce(
							(sum, session) => sum + session.results.accuracy,
							0
					  ) / recentWeek.length
					: 0;

			const previousAccuracy =
				previousWeek.length > 0
					? previousWeek.reduce(
							(sum, session) => sum + session.results.accuracy,
							0
					  ) / previousWeek.length
					: 0;

			if (recentAccuracy > previousAccuracy + 5) {
				insights.push({
					type: "positive",
					title: "Improving Performance",
					message: `Your accuracy has improved by ${(
						recentAccuracy - previousAccuracy
					).toFixed(1)}% this week!`,
					icon: "trending-up",
				});
			} else if (recentAccuracy < previousAccuracy - 5) {
				insights.push({
					type: "warning",
					title: "Performance Dip",
					message: `Your accuracy has decreased by ${(
						previousAccuracy - recentAccuracy
					).toFixed(1)}% this week. Consider reviewing fundamentals.`,
					icon: "trending-down",
				});
			}
		}

		// Category analysis
		const categoryPerformance = {};
		practiceSessions.forEach((session) => {
			session.questions.forEach((q) => {
				const categoryName = session.settings.categories[0]?.name || "General";
				if (!categoryPerformance[categoryName]) {
					categoryPerformance[categoryName] = { attempted: 0, correct: 0 };
				}
				categoryPerformance[categoryName].attempted += 1;
				if (q.isCorrect) categoryPerformance[categoryName].correct += 1;
			});
		});

		// Find strongest and weakest categories
		const categories = Object.keys(categoryPerformance)
			.map((name) => ({
				name,
				accuracy:
					(categoryPerformance[name].correct /
						categoryPerformance[name].attempted) *
					100,
				attempted: categoryPerformance[name].attempted,
			}))
			.filter((cat) => cat.attempted >= 5); // Only consider categories with sufficient data

		if (categories.length > 0) {
			const strongest = categories.reduce((max, cat) =>
				cat.accuracy > max.accuracy ? cat : max
			);
			const weakest = categories.reduce((min, cat) =>
				cat.accuracy < min.accuracy ? cat : min
			);

			if (strongest.accuracy > 80) {
				insights.push({
					type: "positive",
					title: "Category Strength",
					message: `You're excelling in ${
						strongest.name
					} with ${strongest.accuracy.toFixed(1)}% accuracy!`,
					icon: "award",
				});
			}

			if (weakest.accuracy < 60) {
				insights.push({
					type: "suggestion",
					title: "Focus Area",
					message: `Consider spending more time on ${
						weakest.name
					}. Your current accuracy is ${weakest.accuracy.toFixed(1)}%.`,
					icon: "target",
				});
			}
		}

		// Difficulty analysis
		const difficultyStats = {
			easy: { attempted: 0, correct: 0 },
			medium: { attempted: 0, correct: 0 },
			hard: { attempted: 0, correct: 0 },
		};

		practiceSessions.forEach((session) => {
			session.questions.forEach((q) => {
				const difficulty = q.difficulty?.toLowerCase() || "medium";
				if (difficultyStats[difficulty]) {
					difficultyStats[difficulty].attempted += 1;
					if (q.isCorrect) difficultyStats[difficulty].correct += 1;
				}
			});
		});

		const hardAccuracy =
			difficultyStats.hard.attempted > 0
				? (difficultyStats.hard.correct / difficultyStats.hard.attempted) * 100
				: 0;

		if (hardAccuracy > 70) {
			insights.push({
				type: "positive",
				title: "Challenge Master",
				message: `You're doing great with hard questions! ${hardAccuracy.toFixed(
					1
				)}% accuracy on difficult problems.`,
				icon: "zap",
			});
		}

		// Practice consistency
		const activeDays = practiceSessions.length;
		const consistencyRate = (activeDays / parseInt(timeRange)) * 100;

		if (consistencyRate > 80) {
			insights.push({
				type: "positive",
				title: "Consistent Learner",
				message: `You've been active ${activeDays} out of ${timeRange} days. Great consistency!`,
				icon: "calendar-check",
			});
		} else if (consistencyRate < 40) {
			insights.push({
				type: "suggestion",
				title: "Build Consistency",
				message: `Try to practice more regularly. You've been active only ${activeDays} out of ${timeRange} days.`,
				icon: "calendar",
			});
		}

		// General recommendations
		if (overallAccuracy < 60) {
			insights.push({
				type: "suggestion",
				title: "Foundation Building",
				message:
					"Focus on understanding core concepts before attempting more questions.",
				icon: "book-open",
			});
		}

		if (totalQuestions < 50 && parseInt(timeRange) >= 30) {
			insights.push({
				type: "suggestion",
				title: "Increase Practice",
				message:
					"Try to answer more questions daily to accelerate your learning.",
				icon: "activity",
			});
		}

		res.json({
			success: true,
			data: {
				insights,
				overallAccuracy: overallAccuracy.toFixed(1),
				totalQuestions,
				activeDays,
				consistencyRate: consistencyRate.toFixed(1),
			},
		});
	} catch (error) {
		console.error("Get AI insights error:", error);
		res.status(500).json({
			success: false,
			message: "Server error",
		});
	}
};

// @desc    Get activity patterns for heatmap
// @route   GET /api/analytics/activity-patterns
// @access  Private
export const getActivityPatterns = async (req, res) => {
	try {
		const userId = req.user.id;
		const { timeRange = "365" } = req.query; // Default to 1 year for heatmap

		// Limit timeRange to prevent performance issues (max 365 days)
		const limitedTimeRange = Math.min(parseInt(timeRange), 365);
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - limitedTimeRange);

		// Get all practice sessions within the time range
		const practiceSessions = await PracticeSession.find({
			user: userId,
			status: "completed",
			completedAt: { $gte: startDate },
		}).sort({ completedAt: 1 });

		// Create a map of dates to activity data
		const activityMap = new Map();

		// Initialize all dates in range with zero activity
		for (
			let d = new Date(startDate);
			d <= new Date();
			d.setDate(d.getDate() + 1)
		) {
			const dateStr = d.toISOString().split("T")[0];
			activityMap.set(dateStr, {
				date: dateStr,
				questionsAnswered: 0,
				practiceTime: 0,
				sessionsCount: 0,
				accuracy: 0,
				level: 0, // 0-4 for GitHub-style intensity
			});
		}

		// Populate with actual session data
		practiceSessions.forEach((session) => {
			const dateStr = session.completedAt.toISOString().split("T")[0];
			const existing = activityMap.get(dateStr) || {
				date: dateStr,
				questionsAnswered: 0,
				practiceTime: 0,
				sessionsCount: 0,
				accuracy: 0,
				level: 0,
			};

			existing.questionsAnswered += session.results.totalQuestions;
			existing.practiceTime += Math.round(session.results.totalTimeSpent / 60); // minutes
			existing.sessionsCount += 1;
			existing.accuracy = session.results.accuracy; // Use latest session accuracy for the day

			activityMap.set(dateStr, existing);
		});

		// Convert to array and calculate intensity levels
		const activityData = Array.from(activityMap.values());

		// Calculate intensity levels based on questions answered
		const maxQuestions = Math.max(
			...activityData.map((d) => d.questionsAnswered)
		);
		activityData.forEach((day) => {
			if (day.questionsAnswered === 0) {
				day.level = 0;
			} else if (day.questionsAnswered <= maxQuestions * 0.25) {
				day.level = 1;
			} else if (day.questionsAnswered <= maxQuestions * 0.5) {
				day.level = 2;
			} else if (day.questionsAnswered <= maxQuestions * 0.75) {
				day.level = 3;
			} else {
				day.level = 4;
			}
		});

		// Calculate streaks
		let currentStreak = 0;
		let longestStreak = 0;
		let tempStreak = 0;

		// Calculate current streak (from today backwards)
		const today = new Date().toISOString().split("T")[0];
		const sortedData = activityData.sort(
			(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
		);

		for (const day of sortedData) {
			if (day.questionsAnswered > 0) {
				if (day.date === today || currentStreak > 0) {
					currentStreak++;
				}
			} else {
				break;
			}
		}

		// Calculate longest streak
		activityData.sort(
			(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
		);
		activityData.forEach((day) => {
			if (day.questionsAnswered > 0) {
				tempStreak++;
				longestStreak = Math.max(longestStreak, tempStreak);
			} else {
				tempStreak = 0;
			}
		});

		// Calculate time distribution (hour of day analysis)
		const hourDistribution = new Array(24).fill(0);
		practiceSessions.forEach((session) => {
			const hour = session.completedAt.getHours();
			hourDistribution[hour] += session.results.totalQuestions;
		});

		// Find peak hours
		const peakHour = hourDistribution.indexOf(Math.max(...hourDistribution));
		const timeDistribution = {
			morning: hourDistribution.slice(6, 12).reduce((a, b) => a + b, 0), // 6AM-12PM
			afternoon: hourDistribution.slice(12, 18).reduce((a, b) => a + b, 0), // 12PM-6PM
			evening: hourDistribution.slice(18, 24).reduce((a, b) => a + b, 0), // 6PM-12AM
			night: hourDistribution.slice(0, 6).reduce((a, b) => a + b, 0), // 12AM-6AM
		};

		// Weekly pattern analysis
		const weeklyPattern = new Array(7).fill(0); // Sunday = 0, Monday = 1, etc.
		activityData.forEach((day) => {
			const dayOfWeek = new Date(day.date).getDay();
			weeklyPattern[dayOfWeek] += day.questionsAnswered;
		});

		// Calculate total stats
		const totalQuestions = activityData.reduce(
			(sum, day) => sum + day.questionsAnswered,
			0
		);
		const totalPracticeTime = activityData.reduce(
			(sum, day) => sum + day.practiceTime,
			0
		);
		const activeDays = activityData.filter(
			(day) => day.questionsAnswered > 0
		).length;
		const averageDaily =
			activeDays > 0 ? Math.round(totalQuestions / activeDays) : 0;

		res.json({
			success: true,
			data: {
				activityData,
				streaks: {
					current: currentStreak,
					longest: longestStreak,
				},
				timeDistribution,
				weeklyPattern,
				peakHour,
				stats: {
					totalQuestions,
					totalPracticeTime,
					activeDays,
					averageDaily,
					totalDays: activityData.length,
					consistencyRate: ((activeDays / activityData.length) * 100).toFixed(
						1
					),
				},
			},
		});
	} catch (error) {
		console.error("Get activity patterns error:", error);
		res.status(500).json({
			success: false,
			message: "Server error",
		});
	}
};

// @desc    Update user stats after practice session (called automatically)
// @route   POST /api/analytics/update-stats
// @access  Private
export const updateUserStats = async (req, res) => {
	try {
		const userId = req.user.id;

		// Get all completed practice sessions for the user
		const sessions = await PracticeSession.find({
			user: userId,
			status: "completed",
		});

		// Calculate updated stats
		const totalQuestions = sessions.reduce(
			(sum, session) => sum + session.results.totalQuestions,
			0
		);
		const totalCorrect = sessions.reduce(
			(sum, session) => sum + session.results.correctAnswers,
			0
		);
		const totalTime = sessions.reduce(
			(sum, session) => sum + session.results.totalTimeSpent,
			0
		);
		const completionRate =
			totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
		const averageTime = totalQuestions > 0 ? totalTime / totalQuestions : 0;

		// Update user stats
		await User.findByIdAndUpdate(userId, {
			$set: {
				"stats.questionsAnswered": totalQuestions,
				"stats.practiceHours": Math.round(totalTime / 3600), // convert to hours
				"stats.totalSessions": sessions.length,
				"stats.completionRate": completionRate,
				"stats.averageTime": averageTime,
				lastActive: new Date(),
			},
		});

		res.json({
			success: true,
			message: "User stats updated successfully",
		});
	} catch (error) {
		console.error("Update user stats error:", error);
		res.status(500).json({
			success: false,
			message: "Server error",
		});
	}
};
