import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const refreshTokenMiddleware = async (req, res, next) => {
	try {
		const refreshToken = req.cookies.refreshToken;
		if (!refreshToken) {
			return res
				.status(401)
				.json({ success: false, message: "Refresh token missing" });
		}

		const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
		const user = await User.findById(decoded.id);
		if (!user) {
			return res
				.status(401)
				.json({ success: false, message: "Invalid refresh token" });
		}

		const newAccessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
			expiresIn: "15m",
		});

		res.cookie("token", newAccessToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "Lax",
			maxAge: 15 * 60 * 1000, // 15 minutes
		});

		req.user = user;
		next();
	} catch (error) {
		console.error("Refresh token error:", error);
		return res
			.status(403)
			.json({ success: false, message: "Token refresh failed" });
	}
};
