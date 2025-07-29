import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

dotenv.config();

export const auth = async (req, res, next) => {
	try {
		const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

		if (!token) {
			return res.status(401).json({
				success: false,
				message: "No token found. Please log in.",
			});
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const user = await User.findById(decoded.id).select("-password");

		if (!user) {
			return res.status(401).json({
				success: false,
				message: "Invalid token or user does not exist.",
			});
		}

		// Attach user to request
		req.user = user;
		next();
	} catch (error) {
		console.error("Auth Middleware Error:", error);
		return res.status(401).json({
			success: false,
			message: "Authentication failed.",
		});
	}
};
