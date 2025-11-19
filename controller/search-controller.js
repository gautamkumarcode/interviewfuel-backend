import Category from "../models/Category.js";
import Question from "../models/Question.js";

// Global search across questions, categories, and tags
export const globalSearch = async (req, res) => {
	try {
		const { q, type, limit = 10, page = 1 } = req.query;

		console.log("Search request received:", { q, type, limit, page });

		if (!q || q.trim().length === 0) {
			return res.status(400).json({
				success: false,
				message: "Search query is required",
			});
		}

		const searchQuery = q.trim();
		console.log("Searching for:", searchQuery);
		const skip = (parseInt(page) - 1) * parseInt(limit);
		const limitNum = parseInt(limit);

		let results = {
			questions: [],
			categories: [],
			tags: [],
			total: 0,
		};

		// Search based on type or search all if no type specified
		const searchTypes = type ? [type] : ["questions", "categories", "tags"];

		// Search Questions
		if (searchTypes.includes("questions")) {
			const questionResults = await Question.find({
				$and: [
					{ status: "published" },
					{
						$or: [
							{ title: { $regex: searchQuery, $options: "i" } },
							{ content: { $regex: searchQuery, $options: "i" } },
							{ tags: { $regex: searchQuery, $options: "i" } },
							{ richAnswer: { $regex: searchQuery, $options: "i" } },
						],
					},
				],
			})
				.select("title slug difficulty tags category stats createdAt")
				.populate("category", "name slug color")
				.populate("author", "name userName")
				.sort({ "stats.views": -1, createdAt: -1 })
				.skip(skip)
				.limit(limitNum)
				.lean();

			results.questions = questionResults;
		}

		// Search Categories
		if (searchTypes.includes("categories")) {
			const categoryResults = await Category.find({
				$and: [
					{ isActive: true },
					{
						$or: [
							{ name: { $regex: searchQuery, $options: "i" } },
							{ description: { $regex: searchQuery, $options: "i" } },
							{ tags: { $regex: searchQuery, $options: "i" } },
						],
					},
				],
			})
				.select("name slug description icon color stats parentCategory")
				.populate("parentCategory", "name slug")
				.sort({ "stats.questionCount": -1, name: 1 })
				.limit(limitNum)
				.lean();

			results.categories = categoryResults;
		}

		// Search Tags (aggregate unique tags from questions)
		if (searchTypes.includes("tags")) {
			const tagResults = await Question.aggregate([
				{ $match: { status: "published" } },
				{ $unwind: "$tags" },
				{
					$match: {
						tags: { $regex: searchQuery, $options: "i" },
					},
				},
				{
					$group: {
						_id: "$tags",
						count: { $sum: 1 },
					},
				},
				{ $sort: { count: -1 } },
				{ $limit: limitNum },
				{
					$project: {
						_id: 0,
						tag: "$_id",
						count: 1,
					},
				},
			]);

			results.tags = tagResults;
		}

		// Calculate total results
		results.total =
			results.questions.length +
			results.categories.length +
			results.tags.length;

		// Get total counts for pagination
		const totalCounts = {
			questions: searchTypes.includes("questions")
				? await Question.countDocuments({
						$and: [
							{ status: "published" },
							{
								$or: [
									{ title: { $regex: searchQuery, $options: "i" } },
									{ content: { $regex: searchQuery, $options: "i" } },
									{ tags: { $regex: searchQuery, $options: "i" } },
								],
							},
						],
				  })
				: 0,
			categories: searchTypes.includes("categories")
				? await Category.countDocuments({
						$and: [
							{ isActive: true },
							{
								$or: [
									{ name: { $regex: searchQuery, $options: "i" } },
									{ description: { $regex: searchQuery, $options: "i" } },
								],
							},
						],
				  })
				: 0,
		};

		res.status(200).json({
			success: true,
			data: results,
			pagination: {
				page: parseInt(page),
				limit: limitNum,
				totalCounts,
			},
			query: searchQuery,
		});
	} catch (error) {
		console.error("Search error:", error);
		res.status(500).json({
			success: false,
			message: "Error performing search",
			error: error.message,
		});
	}
};

// Search suggestions (autocomplete)
export const searchSuggestions = async (req, res) => {
	try {
		const { q, limit = 5 } = req.query;

		if (!q || q.trim().length < 2) {
			return res.status(400).json({
				success: false,
				message: "Search query must be at least 2 characters",
			});
		}

		const searchQuery = q.trim();
		const limitNum = parseInt(limit);

		console.log("Getting suggestions for:", searchQuery);

		// Get question title suggestions (match anywhere in title)
		const questionSuggestions = await Question.find({
			status: "published",
			title: { $regex: searchQuery, $options: "i" },
		})
			.select("title slug category")
			.populate("category", "slug")
			.limit(limitNum)
			.lean();

		console.log("Found questions:", questionSuggestions.length);

		// Get category suggestions (match anywhere in name)
		const categorySuggestions = await Category.find({
			isActive: true,
			name: { $regex: searchQuery, $options: "i" },
		})
			.select("name slug icon color")
			.limit(limitNum)
			.lean();

		console.log("Found categories:", categorySuggestions.length);

		// Get tag suggestions (match anywhere in tag)
		const tagSuggestions = await Question.aggregate([
			{ $match: { status: "published" } },
			{ $unwind: "$tags" },
			{
				$match: {
					tags: { $regex: searchQuery, $options: "i" },
				},
			},
			{
				$group: {
					_id: "$tags",
					count: { $sum: 1 },
				},
			},
			{ $sort: { count: -1 } },
			{ $limit: limitNum },
			{
				$project: {
					_id: 0,
					tag: "$_id",
					count: 1,
				},
			},
		]);

		console.log("Found tags:", tagSuggestions.length);

		const responseData = {
			questions: questionSuggestions.map((q) => ({
				type: "question",
				label: q.title,
				value: q.slug,
				categorySlug: q.category?.slug || "",
			})),
			categories: categorySuggestions.map((c) => ({
				type: "category",
				label: c.name,
				value: c.slug,
				icon: c.icon,
				color: c.color,
			})),
			tags: tagSuggestions.map((t) => ({
				type: "tag",
				label: t.tag,
				value: t.tag,
				count: t.count,
			})),
		};

		console.log("Returning suggestions:", {
			questions: responseData.questions.length,
			categories: responseData.categories.length,
			tags: responseData.tags.length,
		});

		res.status(200).json({
			success: true,
			data: responseData,
		});
	} catch (error) {
		console.error("Search suggestions error:", error);
		res.status(500).json({
			success: false,
			message: "Error getting search suggestions",
			error: error.message,
		});
	}
};

// Popular searches
export const getPopularSearches = async (req, res) => {
	try {
		// Get most popular tags
		const popularTags = await Question.aggregate([
			{ $match: { status: "published" } },
			{ $unwind: "$tags" },
			{
				$group: {
					_id: "$tags",
					count: { $sum: 1 },
				},
			},
			{ $sort: { count: -1 } },
			{ $limit: 10 },
			{
				$project: {
					_id: 0,
					tag: "$_id",
					count: 1,
				},
			},
		]);

		// Get most viewed questions
		const popularQuestions = await Question.find({ status: "published" })
			.select("title slug stats.views category")
			.populate("category", "slug")
			.sort({ "stats.views": -1 })
			.limit(5)
			.lean();

		// Get categories with most questions
		const popularCategories = await Category.find({ isActive: true })
			.select("name slug stats.questionCount icon color")
			.sort({ "stats.questionCount": -1 })
			.limit(5)
			.lean();

		res.status(200).json({
			success: true,
			data: {
				tags: popularTags,
				questions: popularQuestions,
				categories: popularCategories,
			},
		});
	} catch (error) {
		console.error("Popular searches error:", error);
		res.status(500).json({
			success: false,
			message: "Error getting popular searches",
			error: error.message,
		});
	}
};
