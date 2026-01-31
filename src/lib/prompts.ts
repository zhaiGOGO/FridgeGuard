import path from "node:path";
import { readFile } from "node:fs/promises";

import type { MemoryProfile } from "../types/ai";

export type PromptKind = "restock" | "recipe" | "profile";

export type PromptContext = {
  memory: MemoryProfile;
  input: string;
};

const PROMPT_DIR = path.join(process.cwd(), "src", "prompts");

const loadPrompt = async (name: string): Promise<string> => {
  const filePath = path.join(PROMPT_DIR, `${name}.md`);
  return readFile(filePath, "utf8");
};

const stringifyMemory = (memory: MemoryProfile): string =>
  JSON.stringify(memory ?? {}, null, 2);

export const buildPrompt = async (
  kind: PromptKind,
  context: PromptContext
): Promise<string> => {
  const [systemPrompt, taskPrompt] = await Promise.all([
    loadPrompt("system"),
    loadPrompt(kind),
  ]);
  const memoryBlock = stringifyMemory(context.memory);
  const today = new Date().toISOString().slice(0, 10);
  const system = systemPrompt
    .replace("{{memory}}", memoryBlock)
    .replace("{{today}}", today);
  const task = taskPrompt.replace("{{input}}", context.input);
  return `${system}\n\n${task}`;
};
