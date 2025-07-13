import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

export interface GeneratedQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// ✅ Define response type for correct typing
interface OpenRouterResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

// Fallback sample questions for when API fails
const FALLBACK_QUESTIONS: GeneratedQuestion[] = [
  {
    question: "What is the capital of France?",
    options: ["London", "Berlin", "Paris", "Madrid"],
    correctAnswer: 2
  },
  {
    question: "Which planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Saturn"],
    correctAnswer: 1
  },
  {
    question: "What is the largest ocean on Earth?",
    options: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean", "Pacific Ocean"],
    correctAnswer: 3
  },
  {
    question: "Who painted the Mona Lisa?",
    options: ["Vincent van Gogh", "Leonardo da Vinci", "Pablo Picasso", "Michelangelo"],
    correctAnswer: 1
  },
  {
    question: "What is the chemical symbol for gold?",
    options: ["Ag", "Au", "Fe", "Cu"],
    correctAnswer: 1
  },
  {
    question: "Which year did World War II end?",
    options: ["1943", "1944", "1945", "1946"],
    correctAnswer: 2
  },
  {
    question: "What is the main component of the sun?",
    options: ["Liquid lava", "Molten iron", "Hot gases", "Solid rock"],
    correctAnswer: 2
  },
  {
    question: "How many sides does a hexagon have?",
    options: ["5", "6", "7", "8"],
    correctAnswer: 1
  },
  {
    question: "Which country is home to the kangaroo?",
    options: ["New Zealand", "South Africa", "Australia", "India"],
    correctAnswer: 2
  },
  {
    question: "What is the largest mammal in the world?",
    options: ["African Elephant", "Blue Whale", "Giraffe", "Hippopotamus"],
    correctAnswer: 1
  }
];

export async function generateQuizQuestions(
  topic: string,
  questionCount: number = 10
): Promise<GeneratedQuestion[]> {
  try {
    const prompt = `Generate ${questionCount} multiple choice quiz questions about "${topic}". 
Each question should have exactly 4 options (A, B, C, D) with only one correct answer.
Make the questions engaging and educational, with varying difficulty levels.

Respond with a JSON object containing an array of questions in this exact format:
{
  "questions": [
    {
      "question": "What is the capital of France?",
      "options": ["London", "Berlin", "Paris", "Madrid"],
      "correctAnswer": 2
    }
  ]
}

Make sure the correctAnswer is the index (0-3) of the correct option in the options array.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost", // Optional
        "X-Title": "QuizGeneratorApp"       // Optional
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1-0528:free",
        messages: [
          {
            role: "system",
            content:
              "You are a quiz generator expert. Generate high-quality, accurate multiple choice questions based on the given topic. Always respond with valid JSON in the requested format.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const data = (await response.json()) as OpenRouterResponse;

    if (!data || !Array.isArray(data.choices) || !data.choices[0]?.message?.content) {
      console.error("❌ Invalid OpenRouter response structure:", data);
      throw new Error("OpenRouter response is missing expected 'choices' structure.");
    }

    let rawContent = data.choices?.[0]?.message?.content || "";

    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("❌ Failed to extract JSON block from response.");
    }

    let result: any;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.error("❌ JSON parse error:", err);
      throw new Error("❌ AI response was not valid JSON");
    }

    if (!result.questions || !Array.isArray(result.questions)) {
      throw new Error("Invalid response format: missing 'questions' array.");
    }

    const validatedQuestions: GeneratedQuestion[] = result.questions.map((q: any, index: number) => {
      if (
        !q.question ||
        !Array.isArray(q.options) ||
        q.options.length !== 4 ||
        typeof q.correctAnswer !== "number" ||
        q.correctAnswer < 0 ||
        q.correctAnswer > 3
      ) {
        throw new Error(`Invalid question format at index ${index}`);
      }

      return {
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
      };
    });

    return validatedQuestions.slice(0, questionCount);
  } catch (error) {
    console.error("❌ Failed to generate quiz questions:", error);
    console.log("🔄 Using fallback questions instead...");
    
    // Return fallback questions instead of throwing an error
    return FALLBACK_QUESTIONS.slice(0, questionCount);
  }
}


