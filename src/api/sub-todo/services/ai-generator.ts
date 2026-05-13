import { GoogleGenAI, Type } from "@google/genai";

const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_SUBTODOS = 5;
const MAX_TITLE_LENGTH = 50;

const cleanTitle = (title: string) => title.trim().replace(/\s+/g, " ");

const fitTitle = (title: string, maxLength = 30) => {
  const normalized = cleanTitle(title);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trim()}...`;
};

const fitTask = (task: string) => {
  const normalized = cleanTitle(task);

  if (normalized.length <= MAX_TITLE_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_TITLE_LENGTH - 3).trim()}...`;
};

const normalizeSubTodos = (items: unknown): string[] => {
  if (!Array.isArray(items)) {
    throw new Error("AI response is not an array");
  }

  const seen = new Set<string>();

  return items
    .filter((item): item is string => typeof item === "string")
    .map(fitTask)
    .filter((item) => {
      if (!item) return false;

      const key = item.toLowerCase();
      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .slice(0, MAX_SUBTODOS);
};

const parseSubTodos = (responseText: string): string[] => {
  const withoutFence = responseText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  try {
    return normalizeSubTodos(JSON.parse(withoutFence));
  } catch {
    const jsonMatch = withoutFence.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      throw new Error("Invalid JSON format in AI response");
    }

    return normalizeSubTodos(JSON.parse(jsonMatch[0]));
  }
};

const getFallbackSubTodos = (todoTitle: string): string[] => {
  const title = fitTitle(todoTitle);
  const lowerTitle = cleanTitle(todoTitle).toLowerCase();

  const fallbackSets: Array<[RegExp, string[]]> = [
    [
      /\b(run|jog|5k|10k|workout|exercise|gym|walk)\b/,
      [
        "Set a realistic workout target",
        "Prepare shoes, clothes, and water",
        "Warm up for 5-10 minutes",
        "Do the planned workout",
        "Log time, distance, and notes",
      ],
    ],
    [
      /\b(study|learn|revise|exam|course|chapter|practice)\b/,
      [
        "Choose the topic to focus on",
        "Gather notes and resources",
        "Study in one focused session",
        "Practice a few questions",
        "Summarize key takeaways",
      ],
    ],
    [
      /\b(write|draft|blog|report|essay|email|proposal)\b/,
      [
        "Outline the main points",
        "Write the first draft",
        "Edit for clarity and flow",
        "Proofread for mistakes",
        "Send or publish the final version",
      ],
    ],
    [
      /\b(shop|buy|grocery|groceries|order|purchase)\b/,
      [
        "Check what you already have",
        "Make a short shopping list",
        "Compare options or prices",
        `Buy items for ${title}`,
        "Put everything away",
      ],
    ],
    [
      /\b(clean|organize|tidy|laundry|declutter)\b/,
      [
        "Clear visible clutter first",
        "Clean the high-use surfaces",
        "Organize items by category",
        "Throw away trash",
        "Do a final reset check",
      ],
    ],
    [
      /\b(meeting|call|interview|sync|appointment)\b/,
      [
        "Define the agenda",
        "Gather notes and context",
        "Confirm time and attendees",
        `Attend ${title}`,
        "Capture next steps",
      ],
    ],
    [
      /\b(code|build|fix|bug|debug|deploy|feature|app)\b/,
      [
        "Reproduce the issue or goal",
        "Inspect the relevant files",
        "Make the smallest useful change",
        "Run checks or test manually",
        "Document what changed",
      ],
    ],
    [
      /\b(travel|trip|flight|hotel|book|pack)\b/,
      [
        "Confirm dates and destination",
        "Compare travel options",
        "Book the essentials",
        "Save confirmations",
        "Pack important items",
      ],
    ],
  ];

  const matchedSet = fallbackSets.find(([pattern]) => pattern.test(lowerTitle));

  const fallback = matchedSet?.[1] ?? [
    `Clarify the goal for ${title}`,
    "Gather what you need",
    "Break it into the first action",
    `Work through ${title}`,
    "Review and mark it done",
  ];

  return normalizeSubTodos(fallback);
};

export const generateSubTodosWithAI = async (
  todoTitle: string,
): Promise<string[]> => {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const fallbackSubTodos = getFallbackSubTodos(todoTitle);

  console.log("[AI-Generator] Starting AI generation for:", todoTitle);

  if (!apiKey) {
    console.log("[AI-Generator] Missing GEMINI_API_KEY");

    return fallbackSubTodos;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
    });

    const prompt = `
You are a productivity assistant.

Given this todo:
"${todoTitle}"

Generate 3 to 5 realistic subtasks.

Rules:
- Return ONLY a valid JSON array
- No markdown
- No explanation
- Each task under 50 characters
- Tasks should be actionable
- Avoid generic words like prepare/start/complete unless specific

Example:
[
  "Choose the running route",
  "Prepare shoes and water",
  "Warm up for 5 minutes",
  "Run at a steady pace",
  "Log distance and time"
]
`;

    console.log("[AI-Generator] Sending request to Gemini model:", model);

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          minItems: 3,
          maxItems: 5,
          items: {
            type: Type.STRING,
          },
        },
      },
    });

    const responseText =
      response.text ||
      response.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";

    console.log("[AI-Generator] Extracted text:", responseText);

    const subTodos = parseSubTodos(responseText);

    if (subTodos.length < 3) {
      throw new Error("AI returned fewer than 3 usable subtasks");
    }

    console.log("[AI-Generator] Final parsed subtodos:", subTodos);

    return subTodos;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[AI-Generator] Error:", message);
    console.log(
      "[AI-Generator] Falling back to local subtodos:",
      fallbackSubTodos,
    );

    return fallbackSubTodos;
  }
};
