import compression from "compression";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoSanitize from "express-mongo-sanitize";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import xss from "xss-clean";

// Import routes

import cookieParser from "cookie-parser";
import "./database/intialdb.js";
import errorHandler from "./middleware/errorHandler.js";
import notFound from "./middleware/notFound.js";
import AchievementRouter from "./routes/achievements.js";
import AuthRouter from "./routes/auth.js";
import CategoriesRouter from "./routes/categories.js";
import PracticeRouter from "./routes/practice.js";
import QuestionsRouter from "./routes/questions.js";
import UserRouter from "./routes/users.js";

dotenv.config();
// Initialize express app

const app = express();
// Middleware to parse cookies
app.use(cookieParser());

// Set security HTTP headers
app.disable("x-powered-by");
app.set("trust proxy", 1); // Trust first proxy for rate limiting

// Enable CORS and set security headers

// Security middleware
app.use(helmet());
app.use(
	cors({
		origin: [
			process.env.FRONTEND_URL,
			"https://interview-fuel.netlify.app/",
			"http://localhost:3000",
		], // your frontend origin
		credentials: true,
	})
);
// Rate limiting
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 100,
	message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Data sanitization
app.use(mongoSanitize());
app.use(xss());

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === "development") {
	app.use(morgan("dev"));
}

// Connect to MongoDB

// Health check
app.get("/health", (req, res) => {
	res.status(200).json({
		status: "success",
		message: "Server is running",
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
	});
});

// Routes
app.use("/api/auth", AuthRouter);
app.use("/api/categories", CategoriesRouter);
app.use("/api/questions", QuestionsRouter);
app.use("/api/practice", PracticeRouter);
app.use("/api/achievements", AchievementRouter);
app.use("/api/users", UserRouter);

// Fallback route for undefined routes

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
	console.log(`🚀 Server running on port ${PORT}`);
	console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
