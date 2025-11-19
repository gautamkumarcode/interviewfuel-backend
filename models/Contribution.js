import mongoose from "mongoose";

const contributionSchema = new mongoose.Schema(
	{
		question: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Question",
			required: true,
			index: true,
		},
		contributor: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		type: {
			type: String,
			enum: [
				"solution",
				"hint",
				"explanation",
				"bestPractice",
				"correction",
				"company",
			],
			required: true,
		},
		// Content structure varies by type
		content: {
			// For solution type
			solution: {
				title: String,
				language: String,
				code: String,
				explanation: String,
				timeComplexity: String,
				spaceComplexity: String,
			},
			// For hint type
			hint: {
				order: Number,
				content: String,
			},
			// For explanation type
			explanation: {
				richAnswer: String,
			},
			// For bestPractice type
			bestPractice: {
				practice: String,
			},
			// For correction type
			correction: {
				field: String, // which field to correct
				oldValue: String,
				newValue: String,
				reason: String,
			},
			// For company type
			company: {
				name: String,
				frequency: Number,
			},
		},
		description: {
			type: String,
			required: true,
			maxlength: 500,
		},
		status: {
			type: String,
			enum: ["pending", "approved", "rejected"],
			default: "pending",
			index: true,
		},
		reviewedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
		reviewedAt: Date,
		reviewComment: String,
	},
	{
		timestamps: true,
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
	}
);

// Indexes
contributionSchema.index({ question: 1, status: 1 });
contributionSchema.index({ contributor: 1, status: 1 });
contributionSchema.index({ createdAt: -1 });

// Methods
contributionSchema.methods.approve = async function (reviewerId, comment) {
	this.status = "approved";
	this.reviewedBy = reviewerId;
	this.reviewedAt = new Date();
	this.reviewComment = comment;
	return this.save();
};

contributionSchema.methods.reject = async function (reviewerId, comment) {
	this.status = "rejected";
	this.reviewedBy = reviewerId;
	this.reviewedAt = new Date();
	this.reviewComment = comment;
	return this.save();
};

// Statics
contributionSchema.statics.getPendingForQuestion = function (questionId) {
	return this.find({ question: questionId, status: "pending" })
		.populate("contributor", "name username avatar")
		.sort({ createdAt: -1 });
};

contributionSchema.statics.getUserContributions = function (userId) {
	return this.find({ contributor: userId })
		.populate("question", "title slug")
		.sort({ createdAt: -1 });
};

export default mongoose.model("Contribution", contributionSchema);
