import jwt from "jsonwebtoken";
import User from "../models/User.js";

const optionalAuth = async (req, res, next) => {
	try {
		const authHeader = req.header("Authorization");
		const token = authHeader?.replace("Bearer ", "");

		if (token) {
			const decoded = jwt.verify(token, process.env.JWT_SECRET);
			// Support both 'id' and 'userId' for backwards compatibility
			const userId = decoded.id || decoded.userId;
			const user = await User.findById(userId).select("-password");

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
