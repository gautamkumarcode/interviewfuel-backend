import mongoose from "mongoose";

const achievementSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: [true, "Achievement title is required"],
			trim: true,
			maxlength: [100, "Title cannot exceed 100 characters"],
		},
		description: {
			type: String,
			required: [true, "Achievement description is required"],
			maxlength: [500, "Description cannot exceed 500 characters"],
		},
		icon: {
			type: String,
			required: true,
		},
		rarity: {
			type: String,
			enum: ["common", "uncommon", "rare", "epic", "legendary"],
			default: "common",
		},
		category: {
			type: String,
			enum: ["practice", "streak", "accuracy", "speed", "volume", "special"],
			required: true,
		},
		criteria: {
			type: {
				type: String,
				enum: ["count", "percentage", "time", "streak", "custom"],
				required: true,
			},
			target: {
				type: Number,
				required: true,
			},
			metric: {
				type: String,
				required: true,
			},
			condition: {
				type: String,
				enum: ["gte", "lte", "eq"],
				default: "gte",
			},
		},
		rewards: {
			points: { type: Number, default: 0 },
			badge: String,
			title: String,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
		order: {
			type: Number,
			default: 0,
		},
	},
	{
		timestamps: true,
	}
);

// Indexes
achievementSchema.index({ category: 1, rarity: 1 });
achievementSchema.index({ isActive: 1 });

// Method to check if user qualifies for achievement
achievementSchema.methods.checkQualification = async function (userId) {
	const User = mongoose.model("User");
	const PracticeSession = mongoose.model("PracticeSession");

	const user = await User.findById(userId);
	if (!user) return false;

	switch (this.criteria.metric) {
		case "questionsAnswered":
			return this.evaluateCondition(
				user.stats.questionsAnswered,
				this.criteria.target
			);

		case "currentStreak":
			return this.evaluateCondition(
				user.stats.currentStreak,
				this.criteria.target
			);

		case "completionRate":
			return this.evaluateCondition(
				user.stats.completionRate,
				this.criteria.target
			);

		case "averageTime":
			return this.evaluateCondition(
				user.stats.averageTime,
				this.criteria.target
			);

		case "totalSessions":
			return this.evaluateCondition(
				user.stats.totalSessions,
				this.criteria.target
			);

		default:
			return false;
	}
};

// Helper method to evaluate conditions
achievementSchema.methods.evaluateCondition = function (value, target) {
	switch (this.criteria.condition) {
		case "gte":
			return value >= target;
		case "lte":
			return value <= target;
		case "eq":
			return value === target;
		default:
			return false;
	}
};
export default mongoose.model("Achievement", achievementSchema);
