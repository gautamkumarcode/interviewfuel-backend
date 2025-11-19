import express from "express";
import { query } from "express-validator";
import {
	getPopularSearches,
	globalSearch,
	searchSuggestions,
} from "../controller/search-controller.js";

const SearchRouter = express.Router();

// Global search
SearchRouter.get(
	"/",
	[
		query("q")
			.trim()
			.notEmpty()
			.withMessage("Search query is required")
			.isLength({ min: 1, max: 100 })
			.withMessage("Search query must be between 1 and 100 characters"),
		query("type")
			.optional()
			.isIn(["questions", "categories", "tags"])
			.withMessage("Invalid search type"),
		query("limit")
			.optional()
			.isInt({ min: 1, max: 50 })
			.withMessage("Limit must be between 1 and 50"),
		query("page")
			.optional()
			.isInt({ min: 1 })
			.withMessage("Page must be a positive integer"),
	],
	globalSearch
);

// Search suggestions (autocomplete)
SearchRouter.get(
	"/suggestions",
	[
		query("q")
			.trim()
			.notEmpty()
			.withMessage("Search query is required")
			.isLength({ min: 2, max: 50 })
			.withMessage("Search query must be between 2 and 50 characters"),
		query("limit")
			.optional()
			.isInt({ min: 1, max: 10 })
			.withMessage("Limit must be between 1 and 10"),
	],
	searchSuggestions
);

// Popular searches
SearchRouter.get("/popular", getPopularSearches);

export default SearchRouter;
