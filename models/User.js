import bcrypt from "bcryptjs";
import crypto from "crypto";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: [true, "Name is required"],
			trim: true,
			maxlength: [50, "Name cannot exceed 50 characters"],
		},
		email: {
			type: String,
			required: [true, "Email is required"],
			unique: true,
			lowercase: true,
			match: [
				/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
				"Please enter a valid email",
			],
		},
		userName: {
			type: String,
			unique: true,
			trim: true,
			minlength: [3, "Username must be at least 3 characters"],
			maxlength: [20, "Username cannot exceed 20 characters"],
			match: [
				/^[a-zA-Z0-9_]+$/,
				"Username can only contain letters, numbers, and underscores",
			],
			default: `user${Date.now()}`, // Default username if not provided
		},
		password: {
			type: String,
			required: function () {
				// Password is only required if not using OAuth
				return !this.oauthProvider;
			},
			minlength: [6, "Password must be at least 6 characters"],
			select: false,
		},
		oauthProvider: {
			type: String,
			enum: ["google", "github", null],
			default: null,
		},
		oauthId: {
			type: String,
			default: null,
		},
		avatar: {
			type: String,
			default: null,
		},
		bio: {
			type: String,
			maxlength: [500, "Bio cannot exceed 500 characters"],
			default: "",
		},
		location: {
			type: String,
			maxlength: [100, "Location cannot exceed 100 characters"],
			default: "",
		},
		website: {
			type: String,
			maxlength: [200, "Website URL cannot exceed 200 characters"],
			default: "",
		},
		social: {
			github: { type: String, default: "" },
			linkedin: { type: String, default: "" },
			twitter: { type: String, default: "" },
		},
		preferences: {
			emailNotifications: { type: Boolean, default: true },
			pushNotifications: { type: Boolean, default: false },
			weeklyDigest: { type: Boolean, default: true },
			practiceReminders: { type: Boolean, default: true },
			publicProfile: { type: Boolean, default: true },
			showStats: { type: Boolean, default: true },
		},
		stats: {
			questionsAnswered: { type: Number, default: 0 },
			practiceHours: { type: Number, default: 0 },
			currentStreak: { type: Number, default: 0 },
			longestStreak: { type: Number, default: 0 },
			completionRate: { type: Number, default: 0 },
			averageTime: { type: Number, default: 0 },
			totalSessions: { type: Number, default: 0 },
			favoriteCategory: { type: String, default: "" },
		},
		likedBlogs: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "BlogPost",
			},
		],
		bookmarkedBlogs: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "BlogPost",
			},
		],
		achievements: [
			{
				achievementId: {
					type: mongoose.Schema.Types.ObjectId,
					ref: "Achievement",
				},
				earnedAt: { type: Date, default: Date.now },
				progress: { type: Number, default: 0 },
			},
		],
		lastActive: {
			type: Date,
			default: Date.now,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
		role: {
			type: String,
			enum: ["user", "admin", "moderator"],
			default: "user",
		},
	},
	{
		timestamps: true,
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
	}
);

// Virtual for user's full profile URL
userSchema.virtual("profileUrl").get(function () {
	return `/users/${this.username}`;
});

// Pre-save middleware to ensure unique username
userSchema.pre("save", async function (next) {
	// Only generate username if it's a new user and username matches default pattern or starts with 'user'
	if (this.isNew && this.userName && this.userName.startsWith("user")) {
		const prefixes = ["ifuel", "fuel", "coder", "dev", "ace", "pro"];
		const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
		const timestamp = Date.now().toString().slice(-6);
		const randomStr = crypto.randomBytes(2).toString("hex");
		this.userName = `${prefix}${timestamp}${randomStr}`;
	}
	next();
});

// Pre-save middleware to hash password
userSchema.pre("save", async function (next) {
	if (!this.isModified("password")) return next();

	try {
		const salt = await bcrypt.genSalt(12);
		this.password = await bcrypt.hash(this.password, salt);
		next();
	} catch (error) {
		next(error);
	}
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
	return await bcrypt.compare(candidatePassword, this.password);
};

// Method to update last active
userSchema.methods.updateLastActive = function () {
	this.lastActive = new Date();
	return this.save({ validateBeforeSave: false });
};

// Method to calculate completion rate
userSchema.methods.calculateCompletionRate = function () {
	// This would be calculated based on practice sessions
	// Implementation depends on your business logic
	return this.stats.completionRate;
};

export default mongoose.model("User", userSchema);
