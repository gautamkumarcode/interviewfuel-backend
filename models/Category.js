import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: [true, "Category name is required"],
			unique: true,
			trim: true,
			maxlength: [50, "Category name cannot exceed 50 characters"],
		},
		slug: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
		},
		description: {
			type: String,
			maxlength: [500, "Description cannot exceed 500 characters"],
		},
		icon: {
			type: String,
			default: "folder",
		},
		color: {
			type: String,
			default: "#6B7280",
		},
		parentCategory: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Category",
			default: null,
		},
		tags: [String],
		stats: {
			questionCount: { type: Number, default: 0 },
			totalViews: { type: Number, default: 0 },
			averageDifficulty: { type: Number, default: 0 },
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
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
	}
);

// Indexes
categorySchema.index({ slug: 1 });
categorySchema.index({ parentCategory: 1 });
categorySchema.index({ order: 1 });

// Virtual for full category path (will only work if populated manually)
categorySchema.virtual("fullPath").get(function () {
	return this.parentCategory
		? `${this.parentCategory.name} > ${this.name}`
		: this.name;
});

// Pre-save middleware to generate slug
categorySchema.pre("save", function (next) {
	if (this.isModified("name")) {
		this.slug = this.name
			.toLowerCase()
			.replace(/[^a-z0-9]/g, "-")
			.replace(/-+/g, "-");
	}
	next();
});

// Method to update question count
categorySchema.methods.updateQuestionCount = async function () {
	const Question = mongoose.model("Question");
	const count = await Question.countDocuments({
		category: this._id,
		status: "published",
	});
	this.stats.questionCount = count;
	return this.save({ validateBeforeSave: false });
};

// Static method to get categories with question counts
categorySchema.statics.getWithCounts = function () {
	return this.aggregate([
		{
			$lookup: {
				from: "questions",
				localField: "_id",
				foreignField: "category",
				as: "questions",
			},
		},
		{
			$addFields: {
				"stats.questionCount": { $size: "$questions" },
			},
		},
		{
			$project: {
				questions: 0,
			},
		},
		{
			$sort: { order: 1, name: 1 },
		},
	]);
};

export default mongoose.model("Category", categorySchema);
