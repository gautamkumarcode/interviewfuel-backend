import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
	{
		question: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Question",
			required: true,
			index: true,
		},
		author: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		content: {
			type: String,
			required: [true, "Comment content is required"],
			trim: true,
			maxlength: [1000, "Comment cannot exceed 1000 characters"],
		},
		parentComment: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Comment", // For threaded replies
			default: null,
		},
		likes: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
		],
		isEdited: {
			type: Boolean,
			default: false,
		},
		isDeleted: {
			type: Boolean,
			default: false,
		},
	},
	{ timestamps: true }
);

// Optional index for efficient nested comment lookups
commentSchema.index({ question: 1, parentComment: 1 });

export default mongoose.model("Comment", commentSchema);
