// utils/gemini.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import {
	generateQuestionsPrompt,
	validateAnswerPrompt,
} from "./genetateQuestionsPrompts.js";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Simple in-memory cache for questions (you can replace with Redis for production)
const questionCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes




// Generate cache key
const getCacheKey = (topic, difficulty, count) => `${topic}-${difficulty}-${count}`;

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
const generateQuestionBatch = async (model, topic, difficulty, count, sessionDuration = 60, calculatedTimePerQuestion = 180, isCustomTopic = false) => {
	const prompt = generateQuestionsPrompt(topic, difficulty, count, sessionDuration, calculatedTimePerQuestion, isCustomTopic);
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

// Fallback questions for when AI generation fails
const generateFallbackQuestions = (topic, difficulty, count) => {
	const fallbackQuestions = [
		{
			title: `What are the key concepts in ${topic}?`,
			content: `Explain the fundamental concepts and principles of ${topic}. Discuss the main components and how they work together.`,
			timeLimit: 180
		},
		{
			title: `How would you implement a solution in ${topic}?`,
			content: `Describe your approach to implementing a typical solution using ${topic}. Include best practices and considerations.`,
			timeLimit: 240
		},
		{
			title: `What are common challenges in ${topic}?`,
			content: `Discuss common problems developers face when working with ${topic} and how to overcome them.`,
			timeLimit: 200
		},
		{
			title: `Compare different approaches in ${topic}`,
			content: `Compare and contrast different methodologies or tools available in ${topic}. When would you use each?`,
			timeLimit: 220
		},
		{
			title: `Optimize performance in ${topic}`,
			content: `How would you optimize performance and efficiency when working with ${topic}? Provide specific techniques.`,
			timeLimit: 260
		}
	];
	
	return fallbackQuestions.slice(0, count);
};

export const generateQuestions = async ({ topic, difficulty, count, sessionDuration = 60, calculatedTimePerQuestion = 180, isCustomTopic = false }) => {
	// Clean expired cache entries periodically
	cleanCache();
	
	// Check cache first (include session duration and custom topic flag in cache key)
	const cacheKey = getCacheKey(topic, difficulty, count) + `-${sessionDuration}min${isCustomTopic ? '-custom' : ''}`;
	const cached = questionCache.get(cacheKey);
	
	if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
		console.log(`Cache hit for ${cacheKey}`);
		return cached.questions;
	}

	
	const model = genAI.getGenerativeModel({
		model: "gemini-2.5-flash", // Try the latest stable model
		generationConfig: {
			temperature: 0.8,
			topK: 40,
			topP: 0.95,
			maxOutputTokens: 1500, // Reduced for faster generation
		},
	});

	const prompt = generateQuestionsPrompt(topic, difficulty, count, sessionDuration, calculatedTimePerQuestion, isCustomTopic);

	try {
		// For larger question counts, generate in smaller batches for better performance
		if (count > 8) {
			const batchSize = Math.ceil(count / 2);
			const batch1Promise = generateQuestionBatch(model, topic, difficulty, batchSize, sessionDuration, calculatedTimePerQuestion, isCustomTopic);
			const batch2Promise = generateQuestionBatch(model, topic, difficulty, count - batchSize, sessionDuration, calculatedTimePerQuestion, isCustomTopic);
			
			const [batch1, batch2] = await Promise.all([batch1Promise, batch2Promise]);
			const allQuestions = [...batch1, ...batch2];
			
			// Cache the result
			questionCache.set(cacheKey, {
				questions: allQuestions,
				timestamp: Date.now()
			});
			
			return allQuestions;
		}

		// Set timeout for AI generation
		const timeoutPromise = new Promise((_, reject) => 
			setTimeout(() => reject(new Error('AI generation timeout')), 15000) // 15 second timeout
		);

		const generationPromise = model.generateContent(prompt);
		const result = await Promise.race([generationPromise, timeoutPromise]);
		
		const text = result.response.text();

		// Clean possible markdown code block formatting
		const cleanText = text.replace(/```json|```/g, "").trim();

		const questions = JSON.parse(cleanText);

		if (!Array.isArray(questions)) {
			throw new Error("Parsed result is not an array.");
		}

		const processedQuestions = questions.map((q) => ({
			title: typeof q.title === "object" ? q.title.text : q.title,
			content: typeof q.content === "object" ? q.content.text : q.content,
			timeLimit: q.timeLimit || 120, // Default fallback
		}));

		// Cache the result
		questionCache.set(cacheKey, {
			questions: processedQuestions,
			timestamp: Date.now()
		});

		return processedQuestions;

	} catch (error) {
		console.error("Error generating questions:", error);
		
		// Fallback to default questions if AI fails
		return generateFallbackQuestions(topic, difficulty, count, calculatedTimePerQuestion);
	}
};

export const evaluateAnswer = async (qaList) => {
	try {
		console.log(`Starting AI evaluation for ${qaList.length} answers...`);
		
		// Check if API key exists
		if (!process.env.GEMINI_API_KEY) {
			console.error("GEMINI_API_KEY is not set in environment variables");
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
		console.log("Generated evaluation prompt, sending to AI...");

		// Add timeout for AI evaluation
		const timeoutPromise = new Promise((_, reject) => 
			setTimeout(() => reject(new Error('AI evaluation timeout')), 30000) // 30 second timeout
		);

		const generationPromise = model.generateContent(prompt);
		const result = await Promise.race([generationPromise, timeoutPromise]);
		
		const text = result.response.text();
		console.log("Received AI response, parsing...");

		// Clean possible markdown code block formatting
		const cleanText = text.replace(/```json|```/g, "").trim();

		// Try to parse the JSON returned from Gemini with robust recovery.
		let parsed = null;
		try {
			parsed = JSON.parse(cleanText);
		} catch (err) {
			console.warn("Initial JSON.parse failed, attempting recovery:", err.message);

			// Attempt 1: extract first JSON array/object substring (likely the intended payload)
			const firstArrayIdx = cleanText.indexOf("[");
			const lastArrayIdx = cleanText.lastIndexOf("]");
			if (firstArrayIdx !== -1 && lastArrayIdx !== -1 && lastArrayIdx > firstArrayIdx) {
				const possible = cleanText.substring(firstArrayIdx, lastArrayIdx + 1);
				try {
					parsed = JSON.parse(possible);
					console.log("Recovered JSON by extracting array substring.");
				} catch (err2) {
					console.warn("Parsing extracted array failed:", err2.message);
				}
			}

			// Attempt 2: sanitize control characters (keep common whitespace \n, \r, \t)
			if (!parsed) {
				// Advanced sanitizer: escape literal newlines/tabs inside quoted strings
				const sanitizeJSONString = (input) => {
					let result = "";
					let inString = false;
					for (let i = 0; i < input.length; i++) {
						const ch = input[i];
						if (ch === '"') {
							// Count backslashes immediately before this quote to decide if escaped
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
					// First sanitize out disallowed control chars outside strings
					const basicSanitized = cleanText.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g, " ");
					// Then escape newlines inside quoted strings
					const advanced = sanitizeJSONString(basicSanitized);
					try {
						parsed = JSON.parse(advanced);
						console.log("Recovered JSON by sanitizing control characters and escaping newlines in strings.");
					} catch (err3) {
						console.warn("Sanitized parse failed:", err3.message);
					}
				} catch (sanErr) {
					console.warn("Sanitization helper failed:", sanErr.message || sanErr);
				}
			}

			// Attempt 3: as a last resort, try to find a {...} object list
			if (!parsed) {
				const firstObj = cleanText.indexOf("{");
				const lastObj = cleanText.lastIndexOf("}");
				if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
					const possibleObj = cleanText.substring(firstObj, lastObj + 1);
					try {
						const maybe = JSON.parse("[" + possibleObj + "]");
						if (Array.isArray(maybe)) parsed = maybe;
					} catch (err4) {
						console.warn("Attempt to parse object substring failed:", err4.message);
					}
				}
			}

			if (!parsed) {
				console.error("Failed to parse Gemini JSON response. Raw response:", cleanText.slice(0, 2000));
				return null;
			}
		}

		// Validate the response structure
		if (!Array.isArray(parsed)) {
			console.error("Gemini response is not an array:", JSON.stringify(parsed).slice(0, 1000));
			return null;
		}

		// Validate each item has required properties
		const isValidResponse = parsed.every(
			(item) =>
				item.hasOwnProperty("question") &&
				item.hasOwnProperty("userAnswer") &&
				item.hasOwnProperty("feedback") &&
				item.hasOwnProperty("score") &&
				typeof item.score === "number"
		);

		if (!isValidResponse) {
			console.error("Gemini response has invalid structure:", cleanText);
			return null;
		}

		console.log(`✅ AI evaluation completed successfully for ${parsed.length} answers`);
		return parsed;

	} catch (error) {
		console.error("AI evaluation failed:", error);
		console.error("Error details:", {
			message: error.message,
			stack: error.stack,
			qaListLength: qaList?.length
		});
		return null;
	}
};
