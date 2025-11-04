import express from "express";
import { query } from "express-validator";
import {
	getActivityPatterns,
	getAIInsights,
	getDashboardAnalytics,
	getPerformanceAnalytics,
	updateUserStats,
} from "../controller/analytics-controller.js";
import { auth } from "../middleware/auth.js";

const AnalyticsRouter = express.Router();

// Get dashboard analytics
AnalyticsRouter.get(
	"/dashboard",
	auth,
	[query("timeRange").optional().isInt({ min: 1, max: 365 })],
	getDashboardAnalytics
);

// Get performance analytics
AnalyticsRouter.get(
	"/performance",
	auth,
	[
		query("timeRange").optional().isInt({ min: 1, max: 365 }),
		query("category").optional().isString(),
		query("difficulty").optional().isIn(["Easy", "Medium", "Hard"]),
	],
	getPerformanceAnalytics
);

// Get AI insights
AnalyticsRouter.get(
	"/insights",
	auth,
	[query("timeRange").optional().isInt({ min: 1, max: 365 })],
	getAIInsights
);

// Get activity patterns for heatmap
AnalyticsRouter.get(
	"/activity-patterns",
	auth,
	[query("timeRange").optional().isInt({ min: 1, max: 365 })],
	getActivityPatterns
);

// Update user stats (called after practice session completion)
AnalyticsRouter.post("/update-stats", auth, updateUserStats);

export default AnalyticsRouter;
