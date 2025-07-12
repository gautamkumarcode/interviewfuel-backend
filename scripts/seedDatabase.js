import dotenv from "dotenv";
import "express-async-errors";
import "module-alias/register";
import mongoose from "mongoose";

// Load env
dotenv.config();

// Import models
import Achievement from "@/models/Achievement.js";
import Category from "@/models/Category.js";
import Question from "@/models/Question.js";
import User from "@/models/User.js";

const seedData = async () => {
	try {
		await mongoose.connect(process.env.MONGODB_URI);
		console.log("✅ MongoDB connected");

		// Clear all collections
		await Promise.all([
			User.deleteMany(),
			Category.deleteMany(),
			Question.deleteMany(),
			Achievement.deleteMany(),
		]);
		console.log("🧹 Cleared existing collections");

		// Create admin user
		const adminUser = await User.create({
			name: "Admin User",
			email: "admin@interviewprep.com",
			username: "admin",
			password: "admin123",
			role: "admin",
			bio: "System administrator and content curator",
			isActive: true,
		});

		// Create sample user
		const sampleUser = await User.create({
			name: "John Doe",
			email: "john@example.com",
			username: "johndoe",
			password: "password123",
			bio: "Full-stack developer preparing for senior engineer interviews",
			location: "San Francisco, CA",
			website: "https://johndoe.dev",
			social: {
				github: "johndoe",
				linkedin: "john-doe-dev",
				twitter: "johndoe_dev",
			},
			stats: {
				questionsAnswered: 342,
				practiceHours: 127,
				currentStreak: 12,
				longestStreak: 28,
				completionRate: 89,
				averageTime: 4.4,
				totalSessions: 156,
				favoriteCategory: "JavaScript",
			},
		});
		console.log("👤 Users created");

		// Create categories
		const categories = await Category.insertMany([
			{ name: "JavaScript", slug: "javascript", description: "JavaScript fundamentals, ES6+, and advanced concepts", icon: "code", color: "#F7DF1E", order: 1 },
			{ name: "React", slug: "react", description: "React components, hooks, state management, and ecosystem", icon: "react", color: "#61DAFB", order: 2 },
			{ name: "Node.js", slug: "nodejs", description: "Server-side JavaScript, APIs, and backend development", icon: "server", color: "#339933", order: 3 },
			{ name: "Algorithms", slug: "algorithms", description: "Data structures, algorithms, and problem-solving", icon: "cpu", color: "#FF6B6B", order: 4 },
			{ name: "System Design", slug: "system-design", description: "Scalability, architecture, and distributed systems", icon: "network", color: "#4ECDC4", order: 5 },
			{ name: "Database", slug: "database", description: "SQL, NoSQL, database design, and optimization", icon: "database", color: "#45B7D1", order: 6 },
		]);
		console.log("📁 Categories created");

		// Get category ids
		const cat = Object.fromEntries(categories.map((c) => [c.slug, c._id]));

		// Create sample questions
		const questions = await Question.insertMany([
			{
				title: "What is the difference between let, const, and var in JavaScript?",
				content: "Explain scope, hoisting, re-declaration, and best practices for let/const/var.",
				category: cat["javascript"],
				difficulty: "Easy",
				tags: ["variables", "es6", "scope"],
				companies: [
					{ name: "Google", frequency: 5 },
					{ name: "Microsoft", frequency: 4 },
				],
				solutions: [{
					title: "Scope Differences Example",
					language: "javascript",
					code: `function letExample() { let x = 1; }`,
					explanation: "let is block scoped.",
				}],
				hints: [{ order: 1, content: "Think about scope types" }],
				bestPractices: ["Use const by default"],
				timeLimit: 15,
				author: adminUser._id,
				status: "published",
			},
			{
				title: "Explain React Hooks and their use cases",
				content: "Explain useState, useEffect and why hooks were introduced.",
				category: cat["react"],
				difficulty: "Medium",
				tags: ["hooks", "react"],
				companies: [
					{ name: "Facebook", frequency: 5 },
					{ name: "Netflix", frequency: 3 },
				],
				solutions: [{
					title: "useState Hook",
					language: "javascript",
					code: `const [count, setCount] = useState(0);`,
					explanation: "Tracks state in function components.",
				}],
				hints: [{ order: 1, content: "Why did class components struggle?" }],
				bestPractices: ["Use custom hooks for reusable logic"],
				timeLimit: 20,
				author: adminUser._id,
				status: "published",
			},
		]);
		console.log("❓ Questions created");

		// Update question counts for categories
		for (const category of categories) {
			await category.updateQuestionCount();
		}

		// Create achievements
		const achievements = await Achievement.insertMany([
			{
				title: "First Steps",
				description: "Complete your first practice session",
				icon: "target",
				rarity: "common",
				category: "practice",
				criteria: { type: "count", target: 1, metric: "totalSessions", condition: "gte" },
				rewards: { points: 10, badge: "first-steps" },
				order: 1,
			},
			{
				title: "Consistency Champion",
				description: "Practice for 7 consecutive days",
				icon: "calendar",
				rarity: "uncommon",
				category: "streak",
				criteria: { type: "streak", target: 7, metric: "currentStreak", condition: "gte" },
				rewards: { points: 50, badge: "consistency-champion" },
				order: 2,
			},
		]);
		console.log("🏆 Achievements created");

		// Assign sample achievement to sample user
		sampleUser.achievements.push({
			achievementId: achievements[0]._id,
			earnedAt: new Date(),
			progress: 100,
		});
		await sampleUser.save();

		// Summary
		console.log("\n📊 Seed Summary:");
		console.table({
			Users: await User.countDocuments(),
			Categories: await Category.countDocuments(),
			Questions: await Question.countDocuments(),
			Achievements: await Achievement.countDocuments(),
		});

		await mongoose.disconnect();
		console.log("✅ Seeding completed and MongoDB disconnected");
	} catch (err) {
		console.error("❌ Seeding failed:", err);
		process.exit(1);
	}
};

seedData();
