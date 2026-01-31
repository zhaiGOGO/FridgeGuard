const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";

type GeminiRequest = {
  prompt: string;
  imageBase64?: string;
  mimeType?: string;
};

type GeminiResponse = {
  text: string;
  json: unknown;
};

const extractJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Gemini response does not contain JSON.");
    }
    const sliced = text.slice(start, end + 1);
    return JSON.parse(sliced);
  }
};

const getMimeType = (data: string | undefined, fallback = "image/jpeg") => {
  if (!data) return fallback;
  const match = data.match(/^data:(.+);base64,/);
  return match?.[1] ?? fallback;
};

const stripDataPrefix = (data: string): string =>
  data.replace(/^data:[^;]+;base64,/, "");

export const generateGeminiJson = async (
  input: GeminiRequest,
  model = DEFAULT_MODEL
): Promise<GeminiResponse> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const parts = [{ text: input.prompt }];
  if (input.imageBase64) {
    parts.push({
      inlineData: {
        mimeType: input.mimeType ?? getMimeType(input.imageBase64),
        data: stripDataPrefix(input.imageBase64),
      },
    });
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${errText}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("") ?? "";
  const json = extractJson(text);

  return { text, json };
};
