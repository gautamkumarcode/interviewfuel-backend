import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const databaseUrl = process.env.MONGODB_URI;
mongoose
	.connect(databaseUrl)
	.then(() => console.log("✅ Connected to MongoDB"))
	.catch((err) => console.error("❌ MongoDB connection error:", err));
