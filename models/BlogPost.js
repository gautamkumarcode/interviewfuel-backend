import mongoose from "mongoose";

const blogPostSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: [true, "Blog title is required"],
			trim: true,
			maxlength: [200, "Title cannot exceed 200 characters"],
		},
		slug: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			trim: true,
			index: true,
		},
		excerpt: {
			type: String,
			trim: true,
			maxlength: [300, "Excerpt cannot exceed 300 characters"],
		},
		content: {
			type: String,
			required: [true, "Blog content is required"],
		},
		coverImage: {
			type: String,
			trim: true,
		},
		author: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		category: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Category",
			index: true,
		},
		tags: [
			{
				type: String,
				trim: true,
				lowercase: true,
			},
		],
		relatedQuestions: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "Question",
			},
		],
		status: {
			type: String,
			enum: ["draft", "published", "archived"],
			default: "draft",
			index: true,
		},
		publishedAt: {
			type: Date,
		},
		views: {
			type: Number,
			default: 0,
		},
		readTime: {
			type: Number, // in minutes
			default: 5,
		},
		stats: {
			likes: { type: Number, default: 0 },
			comments: { type: Number, default: 0 },
			bookmarks: { type: Number, default: 0 },
		},
		seo: {
			metaTitle: { type: String, maxlength: 60 },
			metaDescription: { type: String, maxlength: 160 },
			keywords: [String],
		},
		featured: {
			type: Boolean,
			default: false,
		},
		isPinned: {
			type: Boolean,
			default: false,
		},
	},
	{
		timestamps: true,
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
	}
);

// Virtual for comments
blogPostSchema.virtual("comments", {
	ref: "Comment",
	localField: "_id",
	foreignField: "targetId",
	match: { targetType: "blogpost" },
});

// Index for search
blogPostSchema.index({ title: "text", content: "text", tags: "text" });

// Index for filtering
blogPostSchema.index({ status: 1, publishedAt: -1 });
blogPostSchema.index({ author: 1, status: 1 });
blogPostSchema.index({ featured: 1, publishedAt: -1 });

// Pre-save middleware to set publishedAt
blogPostSchema.pre("save", function (next) {
	if (
		this.isModified("status") &&
		this.status === "published" &&
		!this.publishedAt
	) {
		this.publishedAt = new Date();
	}
	next();
});

// Generate slug from title if not provided
blogPostSchema.pre("validate", function (next) {
	if (this.title && !this.slug) {
		this.slug = this.title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "");
	}
	next();
});

// Calculate read time based on content length
blogPostSchema.pre("save", function (next) {
	if (this.isModified("content")) {
		const wordsPerMinute = 200;
		const wordCount = this.content.split(/\s+/).length;
		this.readTime = Math.ceil(wordCount / wordsPerMinute);
	}
	next();
});

const BlogPost = mongoose.model("BlogPost", blogPostSchema);

export default BlogPost;
