import { NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { buildPrompt } from "@/lib/prompts";
import { generateGeminiJson } from "@/lib/gemini-server";
import type { MemoryProfile, RestockResult } from "@/types/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RestockRequest = {
  imageBase64?: string;
  text?: string;
  memory?: MemoryProfile;
  useLocalAsset?: boolean;
};

const loadLocalAsset = async (): Promise<string> => {
  const assetPath = path.join(process.cwd(), "..", "asset", "test.jpg");
  const buffer = await readFile(assetPath);
  return buffer.toString("base64");
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RestockRequest;
    const memory = body.memory ?? {};
    const input = body.text ?? "请从图片中识别食材并估算保质期。";
    const prompt = await buildPrompt("restock", { memory, input });

    const imageBase64 = body.useLocalAsset
      ? await loadLocalAsset()
      : body.imageBase64;

    const { json, text } = await generateGeminiJson({
      prompt,
      imageBase64,
    });

    return NextResponse.json({
      result: json as RestockResult,
      raw: text,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
