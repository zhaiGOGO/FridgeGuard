import { NextResponse } from "next/server";

import { buildPrompt } from "@/lib/prompts";
import { generateGeminiJson } from "@/lib/gemini-server";
import type { MemoryProfile, RecipeResult } from "@/types/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RecipeRequest = {
  text?: string;
  memory?: MemoryProfile;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RecipeRequest;
    const memory = body.memory ?? {};
    const input = body.text ?? "请根据现有食材给出优先消耗的食谱建议。";
    const prompt = await buildPrompt("recipe", { memory, input });

    const { json, text } = await generateGeminiJson({ prompt });

    return NextResponse.json({
      result: json as RecipeResult,
      raw: text,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
