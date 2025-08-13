// utils/gemini.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import {
	generateQuestionsPrompt,
	validateAnswerPrompt,
} from "./genetateQuestionsPrompts.js";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const generateQuestions = async ({ topic, difficulty, count }) => {
	const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

	const prompt = generateQuestionsPrompt(topic, difficulty, count);

	const result = await model.generateContent(prompt);
	const text = result.response.text();

	// Clean possible markdown code block formatting (e.g., ```json ... ```)
	const cleanText = text.replace(/```json|```/g, "").trim();

	try {
		const questions = JSON.parse(cleanText);

		if (!Array.isArray(questions)) {
			throw new Error("Parsed result is not an array.");
		}

		return questions.map((q) => ({
			title: typeof q.title === "object" ? q.title.text : q.title,
			content: typeof q.content === "object" ? q.content.text : q.content,
			timeLimit: q.timeLimit,
		}));
	} catch (error) {
		console.error("Error parsing JSON:", error);
		throw new Error("Failed to parse generated questions.");
	}
};

export const evaluateAnswer = async (qaList) => {
	const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

	// Import the revised prompt function for arrays
	const prompt = validateAnswerPrompt(qaList);

	const result = await model.generateContent(prompt);
	const text = result.response.text();

	// Clean possible markdown code block formatting (e.g., ```json ... ```)
	const cleanText = text.replace(/```json|```/g, "").trim();

	// Try to parse the JSON returned from Gemini
	try {
		const parsed = JSON.parse(cleanText);

		// Validate the response structure
		if (!Array.isArray(parsed)) {
			console.error("Gemini response is not an array:", cleanText);
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

		return parsed;
	} catch (err) {
		console.error("Failed to parse Gemini response:", cleanText);
		return null;
	}
};
