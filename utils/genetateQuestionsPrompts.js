export const generateQuestionsPrompt = (topic, difficulty, count) => `
You are an expert technical interviewer.

Generate ${count} ${difficulty} level interview questions on topic "${topic}".
Each question should include:
- title (short one-liner)
- content (detailed text for display)
- timeLimit (in seconds, between 60 and 300)

Respond in JSON format as an array like:
[
  {
    "title": "What is useEffect in React?",
    "content": "Explain the useEffect hook, how it's used and its dependencies.",
    "timeLimit": 120
  },
  ...
]
Make sure all questions are unique, clear, and relevant to the topic.
`;

export const validateAnswerPrompt = (qaList) => `
You are an expert technical evaluator.

Evaluate the following interview answers and provide detailed feedback for each.

Here is the list of questions and user answers:

${JSON.stringify(qaList, null, 2)}

For each item, respond in this JSON format:
[
  {
    "question": "<original question>",
    "userAnswer": "<user's answer>",
    "isCorrect": true | false,
    "feedback": "Explain what is correct, missing, or incorrect in the user's answer.",
    "score": 0-10
  }
]

Be objective, technically accurate, and constructive in your feedback.
`;
