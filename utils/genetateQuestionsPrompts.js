export const generateQuestionsPrompt = (
	topic,
	difficulty,
	count,
	sessionDuration = 60,
	calculatedTimePerQuestion = 180,
	isCustomTopic = false
) => `
Generate ${count} ${difficulty} interview questions for "${topic}".

${
	isCustomTopic
		? `
🎯 CUSTOM TOPIC INSTRUCTIONS:
- This is a user-specified custom topic: "${topic}"
- Create relevant, practical interview questions for this specific domain
- Ensure questions are appropriate for technical interviews
- Focus on real-world applications and problem-solving
`
		: `
📚 CATEGORY-BASED INSTRUCTIONS:
- This topic is from our curated categories
- Create standard technical interview questions
- Follow established patterns for this domain
`
}

CRITICAL TIME CONSTRAINT:
- Total session duration: ${sessionDuration} minutes (${
	sessionDuration * 60
} seconds)
- Number of questions: ${count}
- Target time per question: ${calculatedTimePerQuestion} seconds
- ALL question timeLimits MUST total approximately ${
	sessionDuration * 60
} seconds

Time Distribution Strategy:
- Simple questions: ${calculatedTimePerQuestion - 60} to ${
	calculatedTimePerQuestion - 20
} seconds
- Medium complexity: ${calculatedTimePerQuestion - 20} to ${
	calculatedTimePerQuestion + 20
} seconds  
- Complex questions: ${calculatedTimePerQuestion + 20} to ${
	calculatedTimePerQuestion + 60
} seconds
- Ensure the sum of all timeLimits ≈ ${sessionDuration * 60} seconds

Return only valid JSON array:
[
  {
    "title": "Question title",
    "content": "Detailed question description", 
    "timeLimit": ${calculatedTimePerQuestion}
  }
]

Requirements:
- ${difficulty} difficulty level
- Distribute time intelligently but TOTAL must be close to ${
	sessionDuration * 60
} seconds
- More complex questions get proportionally more time
- Minimum 60 seconds, maximum ${
	calculatedTimePerQuestion + 60
} seconds per question
- Clear, concise questions
- No markdown formatting
- Valid JSON only
`;

export const validateAnswerPrompt = (qaList) => `
You are an expert technical evaluator. Evaluate the following interview answers.

Questions and Answers:
${JSON.stringify(qaList, null, 2)}

CRITICAL: Return ONLY valid JSON array. No markdown, no explanations, just JSON.

[
  {
    "question": "exact question text",
    "userAnswer": "exact user answer",
    "isCorrect": true,
    "feedback": "Detailed constructive feedback",
    "score": 8
  }
]

Evaluation Criteria:
- Score 0-10 (0=completely wrong, 10=perfect)
- isCorrect: true if answer demonstrates good understanding
- feedback: Specific, constructive, technical feedback
- Compare against modelAnswer if provided
- Focus on technical accuracy and completeness
- Be objective and helpful

Return valid JSON array only.`;
