import BlogPost from "../models/BlogPost.js";
import Comment from "../models/Comment.js";
import User from "../models/User.js";

// Get all blog posts with filters
export const getAllBlogs = async (req, res) => {
	try {
		const {
			page = 1,
			limit = 10,
			status = "published",
			category,
			tag,
			author,
			search,
			featured,
			sort = "-publishedAt",
		} = req.query;

		const query = {};

		// Filter by status
		if (status) {
			query.status = status;
		}

		// Filter by category
		if (category) {
			query.category = category;
		}

		// Filter by tag
		if (tag) {
			query.tags = tag;
		}

		// Filter by author
		if (author) {
			query.author = author;
		}

		// Filter by featured
		if (featured === "true") {
			query.featured = true;
		}

		// Search in title, content, and tags
		if (search) {
			query.$text = { $search: search };
		}

		const skip = (parseInt(page) - 1) * parseInt(limit);

		const blogs = await BlogPost.find(query)
			.populate("author", "username fullName profilePicture")
			.populate("category", "name slug")
			.sort(sort)
			.skip(skip)
			.limit(parseInt(limit))
			.lean();

		const total = await BlogPost.countDocuments(query);

		res.status(200).json({
			success: true,
			data: {
				blogs,
				pagination: {
					page: parseInt(page),
					limit: parseInt(limit),
					total,
					pages: Math.ceil(total / parseInt(limit)),
				},
			},
		});
	} catch (error) {
		console.error("Error fetching blogs:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch blogs",
			error: error.message,
		});
	}
};

// Get a single blog post by slug
export const getBlogBySlug = async (req, res) => {
	try {
		const { slug } = req.params;
		const userId = req.user?._id; // From optional auth middleware

		const blog = await BlogPost.findOne({ slug })
			.populate("author", "userName name profilePicture bio")
			.populate("category", "name slug")
			.populate("relatedQuestions", "title difficulty slug");

		if (!blog) {
			return res.status(404).json({
				success: false,
				message: "Blog post not found",
			});
		}

		// Increment view count
		blog.views += 1;
		await blog.save();

		// Get comments
		const comments = await Comment.find({
			targetId: blog._id,
			targetType: "blogpost",
		})
			.populate("userId", "username fullName profilePicture")
			.sort("-createdAt");

		// Check if user has liked/bookmarked the blog
		let isLiked = false;
		let isBookmarked = false;

		if (userId) {
			const user = await User.findById(userId).select(
				"likedBlogs bookmarkedBlogs",
			);
			if (user) {
				isLiked =
					user.likedBlogs?.some(
						(blogId) => blogId.toString() === blog._id.toString(),
					) ?? false;
				isBookmarked =
					user.bookmarkedBlogs?.some(
						(blogId) => blogId.toString() === blog._id.toString(),
					) ?? false;
			}
		}

		res.status(200).json({
			success: true,
			data: {
				blog,
				comments,
				isLiked,
				isBookmarked,
			},
		});
	} catch (error) {
		console.error("Error fetching blog:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch blog post",
			error: error.message,
		});
	}
};

// Create a new blog post
export const createBlog = async (req, res) => {
	try {
		const {
			title,
			slug,
			excerpt,
			content,
			coverImage,
			category,
			tags,
			relatedQuestions,
			status,
			seo,
		} = req.body;

		const blog = new BlogPost({
			title,
			slug,
			excerpt,
			content,
			coverImage,
			author: req.user._id,
			category,
			tags,
			relatedQuestions,
			status: status || "draft",
			seo,
		});

		await blog.save();

		const populatedBlog = await BlogPost.findById(blog._id)
			.populate("author", "username fullName profilePicture")
			.populate("category", "name slug");

		res.status(201).json({
			success: true,
			message: "Blog post created successfully",
			data: populatedBlog,
		});
	} catch (error) {
		console.error("Error creating blog:", error);
		res.status(500).json({
			success: false,
			message: "Failed to create blog post",
			error: error.message,
		});
	}
};

// Update a blog post
export const updateBlog = async (req, res) => {
	try {
		const { id } = req.params;
		const updates = req.body;

		const blog = await BlogPost.findById(id);

		if (!blog) {
			return res.status(404).json({
				success: false,
				message: "Blog post not found",
			});
		}

		// Check if user is the author or admin
		if (
			blog.author.toString() !== req.user._id.toString() &&
			req.user.role !== "admin"
		) {
			return res.status(403).json({
				success: false,
				message: "You are not authorized to update this blog post",
			});
		}

		Object.assign(blog, updates);
		await blog.save();

		const updatedBlog = await BlogPost.findById(blog._id)
			.populate("author", "username fullName profilePicture")
			.populate("category", "name slug");

		res.status(200).json({
			success: true,
			message: "Blog post updated successfully",
			data: updatedBlog,
		});
	} catch (error) {
		console.error("Error updating blog:", error);
		res.status(500).json({
			success: false,
			message: "Failed to update blog post",
			error: error.message,
		});
	}
};

// Delete a blog post
export const deleteBlog = async (req, res) => {
	try {
		const { id } = req.params;

		const blog = await BlogPost.findById(id);

		if (!blog) {
			return res.status(404).json({
				success: false,
				message: "Blog post not found",
			});
		}

		// Check if user is the author or admin
		if (
			blog.author.toString() !== req.user._id.toString() &&
			req.user.role !== "admin"
		) {
			return res.status(403).json({
				success: false,
				message: "You are not authorized to delete this blog post",
			});
		}

		await blog.deleteOne();

		// Delete associated comments
		await Comment.deleteMany({ targetId: blog._id, targetType: "blogpost" });

		res.status(200).json({
			success: true,
			message: "Blog post deleted successfully",
		});
	} catch (error) {
		console.error("Error deleting blog:", error);
		res.status(500).json({
			success: false,
			message: "Failed to delete blog post",
			error: error.message,
		});
	}
};

// Like a blog post
export const likeBlog = async (req, res) => {
	try {
		const { id } = req.params;
		const userId = req.user._id;

		const blog = await BlogPost.findById(id);

		if (!blog) {
			return res.status(404).json({
				success: false,
				message: "Blog post not found",
			});
		}

		const user = await User.findById(userId);

		// Check if already liked
		const likedIndex = user.likedBlogs?.findIndex(
			(blogId) => blogId.toString() === id,
		);

		if (likedIndex > -1) {
			// Unlike
			user.likedBlogs.splice(likedIndex, 1);
			blog.stats.likes = Math.max(0, blog.stats.likes - 1);
		} else {
			// Like
			if (!user.likedBlogs) user.likedBlogs = [];
			user.likedBlogs.push(id);
			blog.stats.likes += 1;
		}

		await user.save();
		await blog.save();

		res.status(200).json({
			success: true,
			message: likedIndex > -1 ? "Blog unliked" : "Blog liked",
			data: {
				likes: blog.stats.likes,
				isLiked: likedIndex === -1,
			},
		});
	} catch (error) {
		console.error("Error liking blog:", error);
		res.status(500).json({
			success: false,
			message: "Failed to like blog post",
			error: error.message,
		});
	}
};

// Bookmark a blog post
export const bookmarkBlog = async (req, res) => {
	try {
		const { id } = req.params;
		const userId = req.user._id;

		const blog = await BlogPost.findById(id);

		if (!blog) {
			return res.status(404).json({
				success: false,
				message: "Blog post not found",
			});
		}

		const user = await User.findById(userId);

		// Check if already bookmarked
		const bookmarkedIndex = user.bookmarkedBlogs?.findIndex(
			(blogId) => blogId.toString() === id,
		);

		if (bookmarkedIndex > -1) {
			// Remove bookmark
			user.bookmarkedBlogs.splice(bookmarkedIndex, 1);
			blog.stats.bookmarks = Math.max(0, blog.stats.bookmarks - 1);
		} else {
			// Add bookmark
			if (!user.bookmarkedBlogs) user.bookmarkedBlogs = [];
			user.bookmarkedBlogs.push(id);
			blog.stats.bookmarks += 1;
		}

		await user.save();
		await blog.save();

		res.status(200).json({
			success: true,
			message: bookmarkedIndex > -1 ? "Bookmark removed" : "Blog bookmarked",
			data: {
				bookmarks: blog.stats.bookmarks,
				isBookmarked: bookmarkedIndex === -1,
			},
		});
	} catch (error) {
		console.error("Error bookmarking blog:", error);
		res.status(500).json({
			success: false,
			message: "Failed to bookmark blog post",
			error: error.message,
		});
	}
};

// Get featured blogs
export const getFeaturedBlogs = async (req, res) => {
	try {
		const limit = parseInt(req.query.limit) || 5;

		const blogs = await BlogPost.find({ status: "published", featured: true })
			.populate("author", "username fullName profilePicture")
			.populate("category", "name slug")
			.sort("-publishedAt")
			.limit(limit)
			.lean();

		res.status(200).json({
			success: true,
			data: blogs,
		});
	} catch (error) {
		console.error("Error fetching featured blogs:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch featured blogs",
			error: error.message,
		});
	}
};

// Get user's blogs
export const getUserBlogs = async (req, res) => {
	try {
		const { userId } = req.params;
		const { page = 1, limit = 10, status } = req.query;

		const query = { author: userId };
		if (status) {
			query.status = status;
		}

		const skip = (parseInt(page) - 1) * parseInt(limit);

		const blogs = await BlogPost.find(query)
			.populate("category", "name slug")
			.sort("-createdAt")
			.skip(skip)
			.limit(parseInt(limit))
			.lean();

		const total = await BlogPost.countDocuments(query);

		res.status(200).json({
			success: true,
			data: {
				blogs,
				pagination: {
					page: parseInt(page),
					limit: parseInt(limit),
					total,
					pages: Math.ceil(total / parseInt(limit)),
				},
			},
		});
	} catch (error) {
		console.error("Error fetching user blogs:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch user blogs",
			error: error.message,
		});
	}
};
