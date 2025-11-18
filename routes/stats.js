import express from "express";
import {
    getLandingStats,
    getRecentActivity,
    getTrendingTopics,
} from "../controller/stats-controller.js";

const StatsRouter = express.Router();

/**
 * @route   GET /api/stats/landing
 * @desc    Get landing page statistics (public)
 * @access  Public
 */
StatsRouter.get("/landing", getLandingStats);

/**
 * @route   GET /api/stats/activity
 * @desc    Get recent activity feed (public)
 * @access  Public
 */
StatsRouter.get("/activity", getRecentActivity);

/**
 * @route   GET /api/stats/trending
 * @desc    Get trending topics and questions (public)
 * @access  Public
 */
StatsRouter.get("/trending", getTrendingTopics);

export default StatsRouter;
