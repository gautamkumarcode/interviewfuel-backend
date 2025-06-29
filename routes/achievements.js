import express from "express";
import {
	checkUserAchievements,
	getAllAchievements,
} from "../controller/achievment-controller.js";
import auth from "../middleware/auth.js";

const AchievementRouter = express.Router();

// Public route to get all achievements
AchievementRouter.get("/", getAllAchievements);

// Private route to check and assign achievements
AchievementRouter.post("/check", auth, checkUserAchievements);

export default AchievementRouter;
