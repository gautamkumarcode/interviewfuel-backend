const adminAuth = (req, res, next) => {
	if (
		req.user &&
		(req.user.role === "admin" || req.user.role === "moderator")
	) {
		next();
	} else {
		res.status(403).json({
			success: false,
			message: "Access denied. Admin privileges required.",
		});
	}
};

export default adminAuth;
