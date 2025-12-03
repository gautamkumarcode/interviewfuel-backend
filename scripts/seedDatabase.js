import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Category from "../models/Category.js";
import Question from "../models/Question.js";
import User from "../models/User.js";

dotenv.config();

// Database connection
const connectDB = async () => {
	try {
		await mongoose.connect(process.env.MONGODB_URI, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		});
		console.log("MongoDB Connected...");
	} catch (err) {
		console.error("Database connection error:", err.message);
		process.exit(1);
	}
};

// Clear existing data
const clearDatabase = async () => {
	try {
		await Category.deleteMany({});
		await User.deleteMany({});
		await Question.deleteMany({});
		console.log("Database cleared");
	} catch (err) {
		console.error("Error clearing database:", err.message);
	}
};

// Seed categories and subcategories
const seedCategories = async () => {
	try {
		// Main categories
		const frontend = await Category.create({
			name: "Frontend",
			slug: "frontend",
			description: "Frontend development technologies and frameworks",
			icon: "monitor",
			color: "#3B82F6",
			order: 1,
		});

		const backend = await Category.create({
			name: "Backend",
			slug: "backend",
			description:
				"Backend development technologies and server-side programming",
			icon: "server",
			color: "#10B981",
			order: 2,
		});

		const database = await Category.create({
			name: "Database",
			slug: "database",
			description: "Database management and query languages",
			icon: "database",
			color: "#F59E0B",
			order: 3,
		});

		const dataStructures = await Category.create({
			name: "Data Structures",
			slug: "data-structures",
			description: "Fundamental data structures and algorithms",
			icon: "code",
			color: "#8B5CF6",
			order: 4,
		});

		const systemDesign = await Category.create({
			name: "System Design",
			slug: "system-design",
			description: "System architecture and design patterns",
			icon: "layout",
			color: "#EF4444",
			order: 5,
		});

		// Frontend subcategories
		const javascript = await Category.create({
			name: "JavaScript",
			slug: "javascript",
			description: "Core JavaScript concepts and ES6+ features",
			icon: "javascript",
			color: "#F7DF1E",
			parentCategory: frontend._id,
			order: 1,
		});

		const react = await Category.create({
			name: "React",
			slug: "react",
			description: "React.js library and ecosystem",
			icon: "react",
			color: "#61DAFB",
			parentCategory: frontend._id,
			order: 2,
		});

		const vue = await Category.create({
			name: "Vue.js",
			slug: "vue",
			description: "Vue.js framework",
			icon: "vue",
			color: "#42B883",
			parentCategory: frontend._id,
			order: 3,
		});

		const angular = await Category.create({
			name: "Angular",
			slug: "angular",
			description: "Angular framework",
			icon: "angular",
			color: "#DD0031",
			parentCategory: frontend._id,
			order: 4,
		});

		const css = await Category.create({
			name: "CSS",
			slug: "css",
			description: "CSS styling and modern layout techniques",
			icon: "css",
			color: "#1572B6",
			parentCategory: frontend._id,
			order: 5,
		});

		// React subcategories
		const reactHooks = await Category.create({
			name: "React Hooks",
			slug: "react-hooks",
			description: "React Hooks and state management",
			icon: "anchor",
			color: "#61DAFB",
			parentCategory: react._id,
			order: 1,
		});

		const reactRouter = await Category.create({
			name: "React Router",
			slug: "react-router",
			description: "React Router for navigation",
			icon: "navigation",
			color: "#61DAFB",
			parentCategory: react._id,
			order: 2,
		});

		const reactPerformance = await Category.create({
			name: "React Performance",
			slug: "react-performance",
			description: "React optimization and performance",
			icon: "zap",
			color: "#61DAFB",
			parentCategory: react._id,
			order: 3,
		});

		// Backend subcategories
		const nodejs = await Category.create({
			name: "Node.js",
			slug: "nodejs",
			description: "Node.js runtime and core modules",
			icon: "nodejs",
			color: "#68A063",
			parentCategory: backend._id,
			order: 1,
		});

		const express = await Category.create({
			name: "Express",
			slug: "express",
			description: "Express.js framework",
			icon: "express",
			color: "#000000",
			parentCategory: backend._id,
			order: 2,
		});

		const restApi = await Category.create({
			name: "REST API",
			slug: "rest-api",
			description: "RESTful API design and best practices",
			icon: "api",
			color: "#10B981",
			parentCategory: backend._id,
			order: 3,
		});

		const authentication = await Category.create({
			name: "Authentication",
			slug: "authentication",
			description: "Authentication and authorization strategies",
			icon: "lock",
			color: "#F59E0B",
			parentCategory: backend._id,
			order: 4,
		});

		// Database subcategories
		const mongodb = await Category.create({
			name: "MongoDB",
			slug: "mongodb",
			description: "MongoDB NoSQL database",
			icon: "mongodb",
			color: "#47A248",
			parentCategory: database._id,
			order: 1,
		});

		const sql = await Category.create({
			name: "SQL",
			slug: "sql",
			description: "SQL and relational databases",
			icon: "sql",
			color: "#4479A1",
			parentCategory: database._id,
			order: 2,
		});

		const postgresql = await Category.create({
			name: "PostgreSQL",
			slug: "postgresql",
			description: "PostgreSQL database",
			icon: "postgresql",
			color: "#336791",
			parentCategory: database._id,
			order: 3,
		});

		// Data Structures subcategories
		const arrays = await Category.create({
			name: "Arrays",
			slug: "arrays",
			description: "Array data structure and operations",
			icon: "array",
			color: "#8B5CF6",
			parentCategory: dataStructures._id,
			order: 1,
		});

		const linkedLists = await Category.create({
			name: "Linked Lists",
			slug: "linked-lists",
			description: "Linked list data structure",
			icon: "link",
			color: "#8B5CF6",
			parentCategory: dataStructures._id,
			order: 2,
		});

		const trees = await Category.create({
			name: "Trees",
			slug: "trees",
			description: "Tree data structures and traversal",
			icon: "tree",
			color: "#8B5CF6",
			parentCategory: dataStructures._id,
			order: 3,
		});

		const graphs = await Category.create({
			name: "Graphs",
			slug: "graphs",
			description: "Graph data structures and algorithms",
			icon: "graph",
			color: "#8B5CF6",
			parentCategory: dataStructures._id,
			order: 4,
		});

		console.log("Categories seeded successfully");

		return {
			frontend,
			backend,
			database,
			dataStructures,
			systemDesign,
			javascript,
			react,
			vue,
			angular,
			css,
			reactHooks,
			reactRouter,
			reactPerformance,
			nodejs,
			express,
			restApi,
			authentication,
			mongodb,
			sql,
			postgresql,
			arrays,
			linkedLists,
			trees,
			graphs,
		};
	} catch (err) {
		console.error("Error seeding categories:", err.message);
		throw err;
	}
};

// Seed users
const seedUsers = async () => {
	try {
		const hashedPassword = await bcrypt.hash("password123", 12);
		const timestamp = Date.now();
		const adminUsername = `admin_${timestamp}`.slice(0, 20);
		const regularUsername = `user_${timestamp}`.slice(0, 20);

		const adminUser = await User.create({
			name: "Admin User",
			email: `admin_${timestamp}@example.com`,
			userName: adminUsername,
			password: hashedPassword,
			role: "admin",
			bio: "I'm the administrator of this platform",
		});

		const regularUser = await User.create({
			name: "Regular User",
			email: `user_${timestamp}@example.com`,
			userName: regularUsername,
			password: hashedPassword,
			bio: "I'm a regular user learning web development",
		});

		console.log("Users seeded successfully");
		return { adminUser, regularUser };
	} catch (err) {
		console.error("Error seeding users:", err.message);
		throw err;
	}
};
