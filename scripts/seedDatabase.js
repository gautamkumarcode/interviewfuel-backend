"use client";

import "express-async-errors";
import "module-alias/register";
import mongoose from "mongoose";

// Load environment variables
require("dotenv").config();

// Import models
import Achievement from "@/models/Achievement.js";
import Category from "@/models/Category.js";
import Question from "@/models/Question.js";
import User from "@/models/User.js";

// Import routes

// Connect to database
mongoose.connect(process.env.MONGODB_URI);

const seedData = async () => {
	try {
		console.log("🌱 Starting database seeding...");

		// Clear existing data
		await User.deleteMany({});
		await Category.deleteMany({});
		await Question.deleteMany({});
		await Achievement.deleteMany({});

		console.log("🗑️  Cleared existing data");

		// Create admin user
		const adminUser = new User({
			name: "Admin User",
			email: "admin@interviewprep.com",
			username: "admin",
			password: "admin123",
			role: "admin",
			bio: "System administrator and content curator",
			isActive: true,
		});
		await adminUser.save();

		// Create sample user
		const sampleUser = new User({
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
		await sampleUser.save();

		console.log("👥 Created users");

		// Create categories
		const categories = [
			{
				name: "JavaScript",
				slug: "javascript",
				description: "JavaScript fundamentals, ES6+, and advanced concepts",
				icon: "code",
				color: "#F7DF1E",
				order: 1,
			},
			{
				name: "React",
				slug: "react",
				description: "React components, hooks, state management, and ecosystem",
				icon: "react",
				color: "#61DAFB",
				order: 2,
			},
			{
				name: "Node.js",
				slug: "nodejs",
				description: "Server-side JavaScript, APIs, and backend development",
				icon: "server",
				color: "#339933",
				order: 3,
			},
			{
				name: "Algorithms",
				slug: "algorithms",
				description: "Data structures, algorithms, and problem-solving",
				icon: "cpu",
				color: "#FF6B6B",
				order: 4,
			},
			{
				name: "System Design",
				slug: "system-design",
				description: "Scalability, architecture, and distributed systems",
				icon: "network",
				color: "#4ECDC4",
				order: 5,
			},
			{
				name: "Database",
				slug: "database",
				description: "SQL, NoSQL, database design, and optimization",
				icon: "database",
				color: "#45B7D1",
				order: 6,
			},
		];

		const createdCategories = await Category.insertMany(categories);
		console.log("📂 Created categories");

		// Create sample questions
		const questions = [
			{
				title:
					"What is the difference between let, const, and var in JavaScript?",
				content: `Explain the key differences between var, let, and const in JavaScript. Include examples of scope, hoisting, and re-assignment behavior.

## Key Areas to Cover:
1. Scope differences (function vs block scope)
2. Hoisting behavior
3. Re-declaration and re-assignment rules
4. Temporal Dead Zone
5. Best practices for usage`,
				category: createdCategories.find((c) => c.slug === "javascript")._id,
				difficulty: "Easy",
				tags: ["variables", "es6", "fundamentals", "scope"],
				companies: [
					{ name: "Google", frequency: 5 },
					{ name: "Microsoft", frequency: 4 },
					{ name: "Amazon", frequency: 3 },
				],
				solutions: [
					{
						title: "Scope Differences Example",
						language: "javascript",
						code: `// var - Function scoped
function varExample() {
  if (true) {
    var x = 1;
  }
  console.log(x); // 1 - accessible outside the block
}

// let - Block scoped
function letExample() {
  if (true) {
    let y = 1;
  }
  console.log(y); // ReferenceError: y is not defined
}

// const - Block scoped
function constExample() {
  if (true) {
    const z = 1;
  }
  console.log(z); // ReferenceError: z is not defined
}`,
						explanation:
							"This example demonstrates how var is function-scoped while let and const are block-scoped.",
						timeComplexity: "O(1)",
						spaceComplexity: "O(1)",
					},
				],
				hints: [
					{
						order: 1,
						content: "Think about where each variable type can be accessed",
					},
					{
						order: 2,
						content:
							"Consider what happens when you try to use a variable before declaring it",
					},
					{
						order: 3,
						content: "Remember the Temporal Dead Zone for let and const",
					},
				],
				bestPractices: [
					"Use const by default for values that won't be re-assigned",
					"Use let when you need to re-assign the variable",
					"Avoid var in modern JavaScript due to its confusing scoping rules",
				],
				timeLimit: 15,
				author: adminUser._id,
				status: "published",
			},
			{
				title: "Explain React Hooks and their use cases",
				content: `Describe what React Hooks are, why they were introduced, and provide examples of common hooks like useState, useEffect, and custom hooks.

## Topics to Cover:
1. What are React Hooks and why were they introduced?
2. Rules of Hooks
3. Common built-in hooks (useState, useEffect, useContext, etc.)
4. Custom hooks and their benefits
5. Comparison with class components`,
				category: createdCategories.find((c) => c.slug === "react")._id,
				difficulty: "Medium",
				tags: ["hooks", "state-management", "functional-components", "react"],
				companies: [
					{ name: "Facebook", frequency: 5 },
					{ name: "Netflix", frequency: 4 },
					{ name: "Airbnb", frequency: 3 },
				],
				solutions: [
					{
						title: "useState Hook Example",
						language: "javascript",
						code: `import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}`,
						explanation:
							"useState allows functional components to have local state.",
						timeComplexity: "O(1)",
						spaceComplexity: "O(1)",
					},
				],
				hints: [
					{
						order: 1,
						content:
							"Think about the problems class components had with state and lifecycle",
					},
					{ order: 2, content: "Consider the rules that hooks must follow" },
					{
						order: 3,
						content: "Remember that hooks allow for better code reuse",
					},
				],
				bestPractices: [
					"Always call hooks at the top level of your React function",
					"Use custom hooks to extract component logic",
					"Use useCallback and useMemo for performance optimization when needed",
				],
				timeLimit: 20,
				author: adminUser._id,
				status: "published",
			},
			{
				title: "Design a URL shortener like bit.ly",
				content: `Design a URL shortening service like bit.ly. Consider the database schema, API design, caching strategy, and how to handle high traffic loads.

## Requirements:
1. Shorten long URLs to short URLs
2. Redirect short URLs to original URLs
3. Handle millions of URLs
4. Analytics and click tracking
5. Custom aliases (optional)
6. Expiration dates (optional)

## Consider:
- Database design
- API endpoints
- Caching strategy
- Load balancing
- Rate limiting
- Analytics`,
				category: createdCategories.find((c) => c.slug === "system-design")._id,
				difficulty: "Hard",
				tags: ["system-design", "scalability", "database", "caching"],
				companies: [
					{ name: "Google", frequency: 4 },
					{ name: "Amazon", frequency: 5 },
					{ name: "Microsoft", frequency: 3 },
					{ name: "Uber", frequency: 4 },
				],
				solutions: [
					{
						title: "Database Schema Design",
						language: "sql",
						code: `-- URLs table
CREATE TABLE urls (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  short_url VARCHAR(10) UNIQUE NOT NULL,
  long_url TEXT NOT NULL,
  user_id BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  click_count BIGINT DEFAULT 0,
  INDEX idx_short_url (short_url),
  INDEX idx_user_id (user_id)
);

-- Analytics table
CREATE TABLE url_analytics (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  url_id BIGINT NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  referer TEXT,
  clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (url_id) REFERENCES urls(id)
);`,
						explanation:
							"Basic database schema for storing URLs and analytics data.",
						timeComplexity: "O(1) for lookups with proper indexing",
						spaceComplexity: "O(n) where n is the number of URLs",
					},
				],
				hints: [
					{
						order: 1,
						content:
							"Think about how to generate unique short URLs efficiently",
					},
					{
						order: 2,
						content: "Consider using base62 encoding for short URLs",
					},
					{ order: 3, content: "Think about caching frequently accessed URLs" },
					{ order: 4, content: "Consider database sharding for scalability" },
				],
				bestPractices: [
					"Use a distributed cache like Redis for frequently accessed URLs",
					"Implement rate limiting to prevent abuse",
					"Use database sharding for horizontal scaling",
					"Implement proper monitoring and analytics",
				],
				timeLimit: 45,
				author: adminUser._id,
				status: "published",
			},
		];

		const createdQuestions = await Question.insertMany(questions);
		console.log("❓ Created questions");

		// Update category question counts
		for (const category of createdCategories) {
			await category.updateQuestionCount();
		}

		// Create achievements
		const achievements = [
			{
				title: "First Steps",
				description: "Complete your first practice session",
				icon: "target",
				rarity: "common",
				category: "practice",
				criteria: {
					type: "count",
					target: 1,
					metric: "totalSessions",
					condition: "gte",
				},
				rewards: {
					points: 10,
					badge: "first-steps",
				},
				order: 1,
			},
			{
				title: "Consistency Champion",
				description: "Practice for 7 consecutive days",
				icon: "calendar",
				rarity: "uncommon",
				category: "streak",
				criteria: {
					type: "streak",
					target: 7,
					metric: "currentStreak",
					condition: "gte",
				},
				rewards: {
					points: 50,
					badge: "consistency-champion",
				},
				order: 2,
			},
			{
				title: "Speed Demon",
				description: "Average under 5 minutes per question",
				icon: "zap",
				rarity: "rare",
				category: "speed",
				criteria: {
					type: "time",
					target: 5,
					metric: "averageTime",
					condition: "lte",
				},
				rewards: {
					points: 100,
					badge: "speed-demon",
				},
				order: 3,
			},
			{
				title: "Perfectionist",
				description: "Achieve 95% completion rate",
				icon: "trophy",
				rarity: "epic",
				category: "accuracy",
				criteria: {
					type: "percentage",
					target: 95,
					metric: "completionRate",
					condition: "gte",
				},
				rewards: {
					points: 200,
					badge: "perfectionist",
				},
				order: 4,
			},
			{
				title: "Knowledge Seeker",
				description: "Answer 500 questions total",
				icon: "book",
				rarity: "legendary",
				category: "volume",
				criteria: {
					type: "count",
					target: 500,
					metric: "questionsAnswered",
					condition: "gte",
				},
				rewards: {
					points: 500,
					badge: "knowledge-seeker",
					title: "Knowledge Seeker",
				},
				order: 5,
			},
		];

		await Achievement.insertMany(achievements);
		console.log("🏆 Created achievements");

		// Update sample user with some achievements
		const firstStepsAchievement = achievements.find(
			(a) => a.title === "First Steps"
		);
		sampleUser.achievements.push({
			achievementId: firstStepsAchievement._id,
			earnedAt: new Date("2024-01-16"),
			progress: 100,
		});
		await sampleUser.save();

		console.log("✅ Database seeding completed successfully!");
		console.log("\n📊 Summary:");
		console.log(`- Users: ${await User.countDocuments()}`);
		console.log(`- Categories: ${await Category.countDocuments()}`);
		console.log(`- Questions: ${await Question.countDocuments()}`);
		console.log(`- Achievements: ${await Achievement.countDocuments()}`);

		process.exit(0);
	} catch (error) {
		console.error("❌ Seeding error:", error);
		process.exit(1);
	}
};

seedData();
