import express from "express";
import {
	getAnalyticsDashboard,
	getLeaderboard,
} from "../controller/analytics-controller.js";
import { auth } from "../middleware/auth.js";
const AnalyticsRouter = express.Router();

AnalyticsRouter.get("/dashboard", auth, getAnalyticsDashboard);
AnalyticsRouter.get("/leaderboard", auth, getLeaderboard);

export default AnalyticsRouter;
