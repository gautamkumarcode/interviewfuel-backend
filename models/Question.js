import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: [true, "Question title is required"],
			trim: true,
			maxlength: [200, "Title cannot exceed 200 characters"],
		},
		content: {
			type: String,
			required: [true, "Question content is required"],
		},
		category: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Category",
			required: [true, "Category is required"],
		},
		subcategory: {
			type: String,
			trim: true,
		},
		difficulty: {
			type: String,
			enum: ["Easy", "Medium", "Hard"],
			required: [true, "Difficulty level is required"],
		},
		tags: [
			{
				type: String,
				trim: true,
				lowercase: true,
			},
		],
		companies: [
			{
				name: { type: String, required: true },
				frequency: { type: Number, default: 1 },
			},
		],
		solutions: [
			{
				title: { type: String, required: true },
				language: { type: String, required: true },
				code: { type: String, required: true },
				explanation: { type: String, required: true },
				timeComplexity: String,
				spaceComplexity: String,
			},
		],
		hints: [
			{
				order: { type: Number, required: true },
				content: { type: String, required: true },
			},
		],
		bestPractices: [String],
		relatedQuestions: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "Question",
			},
		],
		timeLimit: {
			type: Number, // in minutes
			default: 30,
		},
		stats: {
			views: { type: Number, default: 0 },
			likes: { type: Number, default: 0 },
			bookmarks: { type: Number, default: 0 },
			attempts: { type: Number, default: 0 },
			successRate: { type: Number, default: 0 },
		},
		author: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		contributors: [
			{
				user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
				contribution: String,
				contributedAt: { type: Date, default: Date.now },
			},
		],
		status: {
			type: String,
			enum: ["draft", "published", "archived"],
			default: "published",
		},
		isVerified: {
			type: Boolean,
			default: false,
		},
		verifiedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
		verifiedAt: Date,
	},
	{
		timestamps: true,
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
	}
);

// Indexes
questionSchema.index({ category: 1, difficulty: 1 });
questionSchema.index({ tags: 1 });
questionSchema.index({ "stats.views": -1 });
questionSchema.index({ "stats.likes": -1 });
questionSchema.index({ createdAt: -1 });
questionSchema.index({ title: "text", content: "text" });

// Virtual for difficulty score
questionSchema.virtual("difficultyScore").get(function () {
	const scores = { Easy: 1, Medium: 2, Hard: 3 };
	return scores[this.difficulty] || 1;
});

// Method to increment views
questionSchema.methods.incrementViews = function () {
	this.stats.views += 1;
	return this.save({ validateBeforeSave: false });
};

// Method to toggle like
questionSchema.methods.toggleLike = function (increment = true) {
	this.stats.likes += increment ? 1 : -1;
	this.stats.likes = Math.max(0, this.stats.likes);
	return this.save({ validateBeforeSave: false });
};

// Method to toggle bookmark
questionSchema.methods.toggleBookmark = function (increment = true) {
	this.stats.bookmarks += increment ? 1 : -1;
	this.stats.bookmarks = Math.max(0, this.stats.bookmarks);
	return this.save({ validateBeforeSave: false });
};

// Static method to get popular questions
questionSchema.statics.getPopular = function (limit = 10) {
	return this.find({ status: "published" })
		.sort({ "stats.views": -1, "stats.likes": -1 })
		.limit(limit)
		.populate("category", "name")
		.populate("author", "name username");
};

// Static method to get questions by difficulty
questionSchema.statics.getByDifficulty = function (difficulty, limit = 20) {
	return this.find({ difficulty, status: "published" })
		.sort({ createdAt: -1 })
		.limit(limit)
		.populate("category", "name")
		.populate("author", "name username");
};

export default mongoose.model("Question", questionSchema);
