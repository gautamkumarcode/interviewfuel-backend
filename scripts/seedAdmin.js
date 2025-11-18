import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
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

// Seed admin user
const seedAdmin = async () => {
	try {
		// Check if admin already exists
		const existingAdmin = await User.findOne({ role: "admin" });

		if (existingAdmin) {
			console.log("Admin user already exists:");
			console.log("Email:", existingAdmin.email);
			console.log("Username:", existingAdmin.userName);
			console.log(
				"\nIf you want to create a new admin, please delete the existing one first."
			);
			return;
		}

		// Admin credentials - Change these values as needed
		const adminData = {
			name: "Gautam Kumar",
			email: "gkvc9696@gmail.com",
			userName: "admin",
			password: "Gautam12@", // Change this to a secure password
			role: "admin",
			bio: "Platform Administrator",
			preferences: {
				emailNotifications: true,
				pushNotifications: true,
				weeklyDigest: true,
				practiceReminders: true,
				publicProfile: false,
				showStats: true,
			},
		};

		// Hash password
		const hashedPassword = await bcrypt.hash(adminData.password, 12);
		adminData.password = hashedPassword;

		// Create admin user
		const adminUser = await User.create(adminData);

		console.log("\n✅ Admin user created successfully!");
		console.log("==========================================");
		console.log("Email:", adminUser.email);
		console.log("Username:", adminUser.userName);
		console.log("Password: Admin@123"); // Display the original password
		console.log("Role:", adminUser.role);
		console.log("==========================================");
		console.log(
			"\n⚠️  IMPORTANT: Please change the password after first login!"
		);
	} catch (err) {
		console.error("Error seeding admin:", err.message);
		throw err;
	}
};

// Main function
const main = async () => {
	try {
		await connectDB();
		await seedAdmin();
		console.log("\nAdmin seeding completed successfully");
		process.exit(0);
	} catch (err) {
		console.error("Admin seeding failed:", err.message);
		process.exit(1);
	}
};

main();
