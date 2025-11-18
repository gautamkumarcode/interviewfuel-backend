import Category from "../models/Category.js";
import PracticeSession from "../models/PracticeSession.js";
import Question from "../models/Question.js";
import User from "../models/User.js";

/**
 * Get landing page statistics
 * @route GET /api/stats/landing
 * @access Public
 */
export const getLandingStats = async (req, res) => {
	try {
		// Get total users count
		const totalUsers = await User.countDocuments({ isActive: true });

		// Get total questions count
		const totalQuestions = await Question.countDocuments({
			status: "published",
		});

		// Get total practice sessions
		const totalSessions = await PracticeSession.countDocuments({
			status: "completed",
		});

		// Calculate success rate (completed sessions with good performance)
		const completedSessions = await PracticeSession.find({
			status: "completed",
		}).select("score");

		let successfulSessions = 0;
		if (completedSessions.length > 0) {
			successfulSessions = completedSessions.filter(
				(session) => session.score >= 70
			).length;
		}

		const successRate =
			completedSessions.length > 0
				? Math.round((successfulSessions / completedSessions.length) * 100)
				: 95; // Default value

		// Get unique companies from questions
		const questionsWithCompanies = await Question.find({
			status: "published",
			"companies.0": { $exists: true },
		}).select("companies");

		const uniqueCompanies = new Set();
		questionsWithCompanies.forEach((question) => {
			question.companies.forEach((company) => {
				uniqueCompanies.add(company.name);
			});
		});

		// Get total categories
		const totalCategories = await Category.countDocuments({ isActive: true });

		// Get average practice hours (from user stats)
		const usersWithStats = await User.find({
			"stats.practiceHours": { $gt: 0 },
		}).select("stats.practiceHours");

		const totalPracticeHours = usersWithStats.reduce(
			(sum, user) => sum + user.stats.practiceHours,
			0
		);

		// Format numbers for display
		const formatNumber = (num) => {
			if (num >= 1000000) {
				return `${(num / 1000000).toFixed(1)}M`;
			} else if (num >= 1000) {
				return `${(num / 1000).toFixed(0)}K`;
			}
			return num.toString();
		};

		const stats = {
			users: {
				total: totalUsers,
				formatted: formatNumber(totalUsers),
				label: "Developers Trained",
			},
			questions: {
				total: totalQuestions,
				formatted: formatNumber(totalQuestions),
				label: "Practice Questions",
			},
			successRate: {
				total: successRate,
				formatted: `${successRate}%`,
				label: "Success Rate",
			},
			companies: {
				total: uniqueCompanies.size,
				formatted: `${uniqueCompanies.size}+`,
				label: "Companies Hiring",
			},
			categories: {
				total: totalCategories,
				formatted: totalCategories.toString(),
				label: "Interview Topics",
			},
			practiceHours: {
				total: totalPracticeHours,
				formatted: formatNumber(totalPracticeHours),
				label: "Practice Hours",
			},
			sessions: {
				total: totalSessions,
				formatted: formatNumber(totalSessions),
				label: "Practice Sessions",
			},
		};

		res.status(200).json({
			success: true,
			data: stats,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Error fetching landing stats:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch statistics",
			error: error.message,
		});
	}
};

/**
 * Get real-time activity feed for landing page
 * @route GET /api/stats/activity
 * @access Public
 */
export const getRecentActivity = async (req, res) => {
	try {
		const limit = parseInt(req.query.limit) || 10;

		// Get recent practice sessions with user info
		const recentSessions = await PracticeSession.find({
			status: "completed",
		})
			.sort({ completedAt: -1 })
			.limit(limit)
			.populate("userId", "name userName avatar")
			.select("userId score completedAt");

		// Get recently added questions
		const recentQuestions = await Question.find({
			status: "published",
		})
			.sort({ createdAt: -1 })
			.limit(5)
			.populate("category", "name")
			.select("title category difficulty createdAt");

		// Get top performers (users with highest stats)
		const topPerformers = await User.find({
			"stats.questionsAnswered": { $gt: 0 },
		})
			.sort({ "stats.questionsAnswered": -1 })
			.limit(5)
			.select(
				"name userName avatar stats.questionsAnswered stats.currentStreak"
			);

		res.status(200).json({
			success: true,
			data: {
				recentSessions,
				recentQuestions,
				topPerformers,
			},
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Error fetching recent activity:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch recent activity",
			error: error.message,
		});
	}
};

/**
 * Get trending topics/categories
 * @route GET /api/stats/trending
 * @access Public
 */
export const getTrendingTopics = async (req, res) => {
	try {
		const limit = parseInt(req.query.limit) || 6;

		// Get categories with most questions
		const trendingCategories = await Category.aggregate([
			{ $match: { isActive: true } },
			{
				$lookup: {
					from: "questions",
					localField: "_id",
					foreignField: "category",
					as: "questions",
				},
			},
			{
				$addFields: {
					questionCount: { $size: "$questions" },
				},
			},
			{ $sort: { questionCount: -1 } },
			{ $limit: limit },
			{
				$project: {
					name: 1,
					description: 1,
					icon: 1,
					questionCount: 1,
				},
			},
		]);

		// Get most popular questions (by views and likes)
		const popularQuestions = await Question.find({
			status: "published",
		})
			.sort({ "stats.views": -1, "stats.likes": -1 })
			.limit(limit)
			.populate("category", "name")
			.select("title category difficulty stats");

		res.status(200).json({
			success: true,
			data: {
				trendingCategories,
				popularQuestions,
			},
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Error fetching trending topics:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch trending topics",
			error: error.message,
		});
	}
};
