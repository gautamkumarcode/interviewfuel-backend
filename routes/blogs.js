import express from "express";
import {
	bookmarkBlog,
	createBlog,
	deleteBlog,
	getAllBlogs,
	getBlogBySlug,
	getFeaturedBlogs,
	getUserBlogs,
	likeBlog,
	updateBlog,
} from "../controller/blog-controller.js";
import { auth } from "../middleware/auth.js";
import optionalAuth from "../middleware/optionalAuth.js";

const router = express.Router();

// Public routes
router.get("/", optionalAuth, getAllBlogs);
router.get("/featured", getFeaturedBlogs);
router.get("/slug/:slug", optionalAuth, getBlogBySlug);
router.get("/user/:userId", getUserBlogs);

// Protected routes
router.post("/", auth, createBlog);
router.put("/:id", auth, updateBlog);
router.delete("/:id", auth, deleteBlog);
router.post("/:id/like", auth, likeBlog);
router.post("/:id/bookmark", auth, bookmarkBlog);

export default router;
