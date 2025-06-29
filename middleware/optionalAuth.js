import jwt from "jsonwebtoken";
import User from "../models/User.js";

const optionalAuth = async (req, res, next) => {
	try {
		const token = req.header("Authorization")?.replace("Bearer ", "");

		if (token) {
			const decoded = jwt.verify(token, process.env.JWT_SECRET);
			const user = await User.findById(decoded.userId).select("-password");

			if (user && user.isActive) {
				req.user = user;
			}
		}

		next();
	} catch (error) {
		// Continue without authentication if token is invalid
		next();
	}
};

export default optionalAuth;
