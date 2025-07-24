import mongoose from "mongoose";

const practiceSessionSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		title: {
			type: String,
			default: "Practice Session",
		},
		questions: [
			{
				question: {
					type: mongoose.Schema.Types.ObjectId,
					ref: "Question",
					required: function () {
						return !this.aiGenerated;
					},
				},
				aiGenerated: { type: Boolean, default: false },
				title: String,
				content: String,
				difficulty: String,
				timeLimit: Number,
				source: { type: String, enum: ["ai", "db"] },
				startedAt: Date,
				// add other fields as needed
			},
		],

		settings: {
			duration: { type: Number, default: 60 }, // in minutes
			questionCount: { type: Number, default: 5 },
			difficulty: {
				type: String,
				enum: ["Easy", "Medium", "Hard", "Mixed"],
				default: "Mixed",
			},
			categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
			includeTimer: { type: Boolean, default: true },
			randomOrder: { type: Boolean, default: true },
		},
		results: {
			totalQuestions: { type: Number, default: 0 },
			answeredQuestions: { type: Number, default: 0 },
			correctAnswers: { type: Number, default: 0 },
			completionRate: { type: Number, default: 0 },
			accuracy: { type: Number, default: 0 },
			totalTimeSpent: { type: Number, default: 0 }, // in seconds
			averageTimePerQuestion: { type: Number, default: 0 },
		},
		status: {
			type: String,
			enum: ["active", "paused", "completed", "abandoned"],
			default: "active",
		},
		startedAt: {
			type: Date,
			default: Date.now,
		},
		completedAt: Date,
		pausedAt: Date,
		totalPausedTime: {
			type: Number,
			default: 0,
		},
	},
	{
		timestamps: true,
	}
);

// Indexes
practiceSessionSchema.index({ user: 1, createdAt: -1 });
practiceSessionSchema.index({ status: 1 });
practiceSessionSchema.index({ "results.completionRate": -1 });

// Method to calculate results
practiceSessionSchema.methods.calculateResults = function () {
	const totalQuestions = this.questions.length;
	const answeredQuestions = this.questions.filter(
		(q) => q.answer && q.answer.trim()
	).length;
	const correctAnswers = this.questions.filter((q) => q.isCorrect).length;

	this.results.totalQuestions = totalQuestions;
	this.results.answeredQuestions = answeredQuestions;
	this.results.correctAnswers = correctAnswers;
	this.results.completionRate =
		totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;
	this.results.accuracy =
		answeredQuestions > 0 ? (correctAnswers / answeredQuestions) * 100 : 0;

	const totalTime = this.questions.reduce(
		(sum, q) => sum + (q.timeSpent || 0),
		0
	);
	this.results.totalTimeSpent = totalTime;
	this.results.averageTimePerQuestion =
		answeredQuestions > 0 ? totalTime / answeredQuestions : 0;

	return this.save();
};

// Method to complete session
practiceSessionSchema.methods.complete = function () {
	this.status = "completed";
	this.completedAt = new Date();
	return this.calculateResults();
};

// Static method to get user statistics
practiceSessionSchema.statics.getUserStats = async function (
	userId,
	timeframe = "30d"
) {
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - Number.parseInt(timeframe));

	return this.aggregate([
		{
			$match: {
				user: mongoose.Types.ObjectId(userId),
				status: "completed",
				completedAt: { $gte: startDate },
			},
		},
		{
			$group: {
				_id: null,
				totalSessions: { $sum: 1 },
				totalQuestions: { $sum: "$results.totalQuestions" },
				totalCorrect: { $sum: "$results.correctAnswers" },
				totalTime: { $sum: "$results.totalTimeSpent" },
				avgCompletionRate: { $avg: "$results.completionRate" },
				avgAccuracy: { $avg: "$results.accuracy" },
			},
		},
	]);
};

export default mongoose.model("PracticeSession", practiceSessionSchema);
