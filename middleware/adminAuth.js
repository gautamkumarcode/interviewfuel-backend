export const requireRole = (roles = []) => {
	return (req, res, next) => {
		if (!roles.includes(req.user.role)) {
			return res.status(403).json({
				success: false,
				message: "Access denied. Insufficient permissions.",
			});
		}
		next();
	};
};
export const adminAuth = (req, res, next) => {
	if (req.user.role !== "admin") {
		return res.status(403).json({
			success: false,
			message: "Access denied. Admins only.",
		});
	}
	next();
};
export const userAuth = (req, res, next) => {
	if (req.user.role !== "user") {
		return res.status(403).json({
			success: false,
			message: "Access denied. Users only.",
		});
	}
	next();
};
