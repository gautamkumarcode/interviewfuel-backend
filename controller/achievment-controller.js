import Achievement from "../models/Achievement.js";
import User from "../models/User.js";

// @desc Get all achievements
// @route GET /api/achievements
// @access Public
export const getAllAchievements = async (req, res) => {
	try {
		const achievements = await Achievement.find({ isActive: true }).sort({
			order: 1,
			rarity: 1,
		});

		res.json({
			success: true,
			data: { achievements },
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Server error",
		});
	}
};

// @desc Check and assign achievements to user
// @route POST /api/achievements/check
// @access Private
export const checkUserAchievements = async (req, res) => {
	try {
		const user = await User.findById(req.user.id);
		const achievements = await Achievement.find({ isActive: true });

		const newAchievements = [];

		for (const achievement of achievements) {
			const hasAchievement = user.achievements.some(
				(ua) => ua.achievementId.toString() === achievement._id.toString()
			);

			if (!hasAchievement) {
				const qualifies = await achievement.checkQualification(req.user.id);

				if (qualifies) {
					user.achievements.push({
						achievementId: achievement._id,
						earnedAt: new Date(),
						progress: 100,
					});
					newAchievements.push(achievement);
				}
			}
		}

		if (newAchievements.length > 0) {
			await user.save();
		}

		res.json({
			success: true,
			data: {
				newAchievements,
				message:
					newAchievements.length > 0
						? `Congratulations! You earned ${newAchievements.length} new achievement(s)!`
						: "No new achievements at this time.",
			},
		});
	} catch (error) {
		console.error("Check achievements error:", error);
		res.status(500).json({
			success: false,
			message: "Server error",
		});
	}
};
