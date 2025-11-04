import mongoose from "mongoose";

const attemptSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		practiceSession: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "PracticeSession",
			required: true,
		},
		question: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Question",
			required: false, // Make optional to handle AI-generated questions
		},
		questionType: {
			type: String,
			enum: ["database", "ai"],
			default: "database",
		},
		aiQuestionData: {
			title: String,
			content: String,
			difficulty: String,
		},
		answer: {
			type: String,
			required: true,
		},
		score: {
			type: Number,
			default: 0,
		},
		feedback: {
			type: String,
		},
		notes: {
			type: String,
		},
		timeSpent: {
			type: Number,
			default: 0, // seconds
		},
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{ timestamps: true }
);

export default mongoose.model("Attempt", attemptSchema);
