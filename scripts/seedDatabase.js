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
			description: "Frontend development technologies",
			icon: "monitor",
			color: "#3B82F6",
		});

		const backend = await Category.create({
			name: "Backend",
			slug: "backend",
			description: "Backend development technologies",
			icon: "server",
			color: "#10B981",
		});

		// Frontend subcategories
		const react = await Category.create({
			name: "React",
			slug: "react",
			description: "React.js library",
			icon: "react",
			color: "#61DAFB",
			parentCategory: frontend._id,
		});

		const angular = await Category.create({
			name: "Angular",
			slug: "angular",
			description: "Angular framework",
			icon: "angular",
			color: "#DD0031",
			parentCategory: frontend._id,
		});

		// React subcategories
		const reactHooks = await Category.create({
			name: "React Hooks",
			slug: "react-hooks",
			description: "React Hooks concepts",
			icon: "anchor",
			color: "#61DAFB",
			parentCategory: react._id,
		});

		const reactRouter = await Category.create({
			name: "React Router",
			slug: "react-router",
			description: "React Router for navigation",
			icon: "navigation",
			color: "#61DAFB",
			parentCategory: react._id,
		});

		// Backend subcategories
		const nodejs = await Category.create({
			name: "Node.js",
			slug: "nodejs",
			description: "Node.js runtime",
			icon: "nodejs",
			color: "#68A063",
			parentCategory: backend._id,
		});

		const express = await Category.create({
			name: "Express",
			slug: "express",
			description: "Express.js framework",
			icon: "express",
			color: "#000000",
			parentCategory: backend._id,
		});

		console.log("Categories seeded successfully");

		return {
			frontend,
			backend,
			react,
			angular,
			reactHooks,
			reactRouter,
			nodejs,
			express,
		};
	} catch (err) {
		console.error("Error seeding categories:", err.message);
	}
};

// Seed users
const seedUsers = async () => {
	try {
		const hashedPassword = await bcrypt.hash("password123", 12);

		// Generate unique usernames that meet validation requirements
		const timestamp = Date.now();
		const adminUsername = `admin_${timestamp}`.slice(0, 20); // Ensure maxlength
		const regularUsername = `user_${timestamp}`.slice(0, 20); // Ensure maxlength

		const adminUser = await User.create({
			name: "Admin User",
			email: `admin_${timestamp}@example.com`, // Also ensure unique email
			userName: adminUsername,
			password: hashedPassword,
			role: "admin",
			bio: "I'm the administrator of this platform",
		});

		const regularUser = await User.create({
			name: "Regular User",
			email: `user_${timestamp}@example.com`, // Unique email
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

// Seed questions
const seedQuestions = async (categories, users) => {
	try {
		// React Hooks questions
		const reactHooksQuestion1 = await Question.create({
			title: "What is useState hook in React?",
			content: "Explain the useState hook and how to use it",
			category: categories.reactHooks._id,
			difficulty: "Easy",
			tags: ["react", "hooks", "usestate"],
			richAnswer:
				"The `useState` hook is a built-in React hook that allows you to add state to functional components...",
			solutions: [
				{
					title: "Basic useState example",
					language: "javascript",
					code: "const [count, setCount] = useState(0);",
					explanation:
						"This initializes a state variable 'count' with initial value 0",
					timeComplexity: "O(1)",
					spaceComplexity: "O(1)",
				},
			],
			hints: [
				{
					order: 1,
					content:
						"useState returns an array with two values: the current state and a function to update it",
				},
			],
			author: users.adminUser._id,
			slug: "what-is-usestate-hook-in-react",
		});

		const reactHooksQuestion2 = await Question.create({
			title: "How does useEffect differ from componentDidMount?",
			content:
				"Compare useEffect hook with class component's componentDidMount",
			category: categories.reactHooks._id,
			difficulty: "Medium",
			tags: ["react", "hooks", "useeffect"],
			richAnswer:
				"The `useEffect` hook serves a similar purpose to `componentDidMount`, `componentDidUpdate`, and `componentWillUnmount` combined...",
			solutions: [
				{
					title: "useEffect vs lifecycle methods",
					language: "javascript",
					code: "useEffect(() => {\n  // Your effect here\n  return () => {\n    // Cleanup\n  };\n}, [dependencies]);",
					explanation:
						"The empty dependency array makes it similar to componentDidMount",
					timeComplexity: "O(1)",
					spaceComplexity: "O(1)",
				},
			],
			author: users.regularUser._id,
			slug: "how-does-useeffect-differ-from-componentdidmount",
		});

		// React Router questions
		const reactRouterQuestion = await Question.create({
			title: "How to implement protected routes in React Router?",
			content: "Explain how to create routes that require authentication",
			category: categories.reactRouter._id,
			difficulty: "Medium",
			tags: ["react", "router", "authentication"],
			richAnswer:
				"To implement protected routes in React Router, you can create a wrapper component that checks for authentication...",
			solutions: [
				{
					title: "ProtectedRoute component",
					language: "javascript",
					code: "const ProtectedRoute = ({ children }) => {\n  const { user } = useAuth();\n  \n  if (!user) {\n    return <Navigate to='/login' />;\n  }\n  \n  return children;\n};",
					explanation:
						"This component checks for a user and redirects to login if not authenticated",
					timeComplexity: "O(1)",
					spaceComplexity: "O(1)",
				},
			],
			author: users.adminUser._id,
			slug: "how-to-implement-protected-routes-in-react-router",
		});

		console.log("Questions seeded successfully");
	} catch (err) {
		console.error("Error seeding questions:", err.message);
	}
};

// Main seeding function
const seedDatabase = async () => {
	try {
		await connectDB();
		await clearDatabase();

		const categories = await seedCategories();
		const users = await seedUsers();
		await seedQuestions(categories, users);

		console.log("Database seeding completed successfully");
		process.exit(0);
	} catch (err) {
		console.error("Database seeding failed:", err.message);
		process.exit(1);
	}
};

seedDatabase();
