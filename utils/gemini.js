// utils/gemini.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
	generateQuestionsPrompt,
	validateAnswerPrompt,
} from "./genetateQuestionsPrompts.js";

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory (for local development)
// In production (AWS/Vercel), environment variables are set directly
dotenv.config({ path: path.join(__dirname, "../.env") });

// Validate API key on module load
if (!process.env.GEMINI_API_KEY) {
	console.warn("⚠️ WARNING: GEMINI_API_KEY not found in environment variables");
	console.warn("AI question generation will not work without a valid API key");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Simple in-memory cache for questions (you can replace with Redis for production)
const questionCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Generate cache key
const getCacheKey = (topic, difficulty, count) =>
	`${topic}-${difficulty}-${count}`;

// Clean expired cache entries
const cleanCache = () => {
	const now = Date.now();
	for (const [key, value] of questionCache.entries()) {
		if (now - value.timestamp > CACHE_DURATION) {
			questionCache.delete(key);
		}
	}
};

// Helper function for batch generation
const generateQuestionBatch = async (
	model,
	topic,
	difficulty,
	count,
	sessionDuration = 60,
	calculatedTimePerQuestion = 180,
	isCustomTopic = false
) => {
	const prompt = generateQuestionsPrompt(
		topic,
		difficulty,
		count,
		sessionDuration,
		calculatedTimePerQuestion,
		isCustomTopic
	);

	const result = await model.generateContent(prompt);
	const text = result.response.text();
	const cleanText = text.replace(/```json|```/g, "").trim();
	const questions = JSON.parse(cleanText);

	if (!Array.isArray(questions)) {
		throw new Error("Parsed result is not an array.");
	}

	return questions.map((q) => ({
		title: typeof q.title === "object" ? q.title.text : q.title,
		content: typeof q.content === "object" ? q.content.text : q.content,
		timeLimit: q.timeLimit || 120,
	}));
};

export const generateQuestions = async ({
	topic,
	difficulty,
	count,
	sessionDuration = 60,
	calculatedTimePerQuestion = 180,
	isCustomTopic = false,
}) => {
	// Clean expired cache entries periodically
	cleanCache();

	// Check cache first (include session duration and custom topic flag in cache key)
	const cacheKey =
		getCacheKey(topic, difficulty, count) +
		`-${sessionDuration}min${isCustomTopic ? "-custom" : ""}`;
	const cached = questionCache.get(cacheKey);

	if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
		return cached.questions;
	}

	const model = genAI.getGenerativeModel({
		model: "gemini-2.5-flash", // Try the latest stable model
		generationConfig: {
			temperature: 0.3,
			topK: 40,
			topP: 0.95,
			maxOutputTokens: 2048,
		},
	});

	const prompt = generateQuestionsPrompt(
		topic,
		difficulty,
		count,
		sessionDuration,
		calculatedTimePerQuestion,
		isCustomTopic
	);

	try {
		// Check if API key is configured
		if (!process.env.GEMINI_API_KEY) {
			throw new Error("AI service not configured - GEMINI_API_KEY missing");
		}

		// For larger question counts, generate in smaller batches for better performance
		if (count > 8) {
			const batchSize = Math.ceil(count / 2);
			const batch1Promise = generateQuestionBatch(
				model,
				topic,
				difficulty,
				batchSize,
				sessionDuration,
				calculatedTimePerQuestion,
				isCustomTopic
			);
			const batch2Promise = generateQuestionBatch(
				model,
				topic,
				difficulty,
				count - batchSize,
				sessionDuration,
				calculatedTimePerQuestion,
				isCustomTopic
			);

			const [batch1, batch2] = await Promise.all([
				batch1Promise,
				batch2Promise,
			]);
			const allQuestions = [...batch1, ...batch2];

			// Cache the result
			questionCache.set(cacheKey, {
				questions: allQuestions,
				timestamp: Date.now(),
			});

			return allQuestions;
		}

		// Set timeout for AI generation
		const timeoutPromise = new Promise((_, reject) =>
			setTimeout(
				() => reject(new Error("AI generation timeout after 30s")),
				30000
			)
		);

		const generationPromise = model.generateContent(prompt);
		const result = await Promise.race([generationPromise, timeoutPromise]);

		const text = result.response.text();
		const cleanText = text.replace(/```json|```/g, "").trim();
		const questions = JSON.parse(cleanText);

		if (!Array.isArray(questions)) {
			throw new Error("Parsed result is not an array.");
		}

		const processedQuestions = questions.map((q) => ({
			title: typeof q.title === "object" ? q.title.text : q.title,
			content: typeof q.content === "object" ? q.content.text : q.content,
			timeLimit: q.timeLimit || 120,
		}));

		// Cache the result
		questionCache.set(cacheKey, {
			questions: processedQuestions,
			timestamp: Date.now(),
		});

		return processedQuestions;
	} catch (error) {
		console.error("AI question generation failed:", error.message);
		throw new Error(`AI question generation failed: ${error.message}`);
	}
};

export const evaluateAnswer = async (qaList) => {
	try {
		// Check if API key exists
		if (!process.env.GEMINI_API_KEY) {
			return null;
		}

		const model = genAI.getGenerativeModel({
			model: "gemini-2.5-flash", // Try the latest stable model
			generationConfig: {
				temperature: 0.3,
				topK: 40,
				topP: 0.95,
				maxOutputTokens: 2048,
			},
		});

		const prompt = validateAnswerPrompt(qaList);

		// Add timeout for AI evaluation
		const timeoutPromise = new Promise(
			(_, reject) =>
				setTimeout(() => reject(new Error("AI evaluation timeout")), 30000) // 30 second timeout
		);

		const generationPromise = model.generateContent(prompt);
		const result = await Promise.race([generationPromise, timeoutPromise]);

		const text = result.response.text();

		// Clean possible markdown code block formatting
		const cleanText = text.replace(/```json|```/g, "").trim();

		// Try to parse the JSON returned from Gemini with robust recovery
		let parsed = null;
		try {
			parsed = JSON.parse(cleanText);
		} catch (err) {
			// Attempt 1: extract first JSON array substring
			const firstArrayIdx = cleanText.indexOf("[");
			const lastArrayIdx = cleanText.lastIndexOf("]");
			if (
				firstArrayIdx !== -1 &&
				lastArrayIdx !== -1 &&
				lastArrayIdx > firstArrayIdx
			) {
				const possible = cleanText.substring(firstArrayIdx, lastArrayIdx + 1);
				try {
					parsed = JSON.parse(possible);
				} catch (err2) {
					// Ignore and try next method
				}
			}

			// Attempt 2: sanitize control characters
			if (!parsed) {
				const sanitizeJSONString = (input) => {
					let result = "";
					let inString = false;
					for (let i = 0; i < input.length; i++) {
						const ch = input[i];
						if (ch === '"') {
							let k = i - 1;
							let backslashes = 0;
							while (k >= 0 && input[k] === "\\") {
								backslashes++;
								k--;
							}
							if (backslashes % 2 === 0) {
								inString = !inString;
							}
							result += ch;
							continue;
						}

						if (inString) {
							if (ch === "\n") result += "\\n";
							else if (ch === "\r") result += "\\r";
							else if (ch === "\t") result += "\\t";
							else result += ch;
						} else {
							result += ch;
						}
					}
					return result;
				};

				try {
					const basicSanitized = cleanText.replace(
						/[\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g,
						" "
					);
					const advanced = sanitizeJSONString(basicSanitized);
					try {
						parsed = JSON.parse(advanced);
					} catch (err3) {
						// Ignore
					}
				} catch (sanErr) {
					// Ignore
				}
			}

			// Attempt 3: try to find object list
			if (!parsed) {
				const firstObj = cleanText.indexOf("{");
				const lastObj = cleanText.lastIndexOf("}");
				if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
					const possibleObj = cleanText.substring(firstObj, lastObj + 1);
					try {
						const maybe = JSON.parse("[" + possibleObj + "]");
						if (Array.isArray(maybe)) parsed = maybe;
					} catch (err4) {
						// Ignore
					}
				}
			}

			if (!parsed) {
				return null;
			}
		}

		// Validate the response structure
		if (!Array.isArray(parsed)) {
			return null;
		}

		// Validate each item has required properties
		const isValidResponse = parsed.every(
			(item) =>
				item.hasOwnProperty("question") &&
				item.hasOwnProperty("userAnswer") &&
				item.hasOwnProperty("isCorrect") &&
				item.hasOwnProperty("feedback") &&
				item.hasOwnProperty("score") &&
				typeof item.score === "number" &&
				typeof item.isCorrect === "boolean"
		);

		if (!isValidResponse) {
			console.error("AI response validation failed - missing required fields");
			return null;
		}

		return parsed;
	} catch (error) {
		console.error("AI evaluation failed:", error.message);
		return null;
	}
};
