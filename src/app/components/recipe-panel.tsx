"use client";

import { useMemo, useState } from "react";

import { db } from "@/lib/db";
import type { RecipeResult, RecipeSuggestion } from "@/types/ai";

import { groupDisplayItems } from "./inventory-helpers";
import { useUser } from "./app-shell";

export default function RecipePanel() {
  const { id: userId } = useUser();
  const { isLoading, error, data } = db.useQuery({
    foodItems: {
      $: {
        order: { expiryAt: "asc" },
        where: { "owner.id": userId },
      },
    },
  });

  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
  const [recipeMessage, setRecipeMessage] = useState("");
  const [recipeResult, setRecipeResult] = useState<RecipeResult | null>(null);

  const foodItems = data?.foodItems ?? [];
  const displayItems = useMemo(() => groupDisplayItems(foodItems), [foodItems]);

  const buildRecipeInput = () => {
    const lines = displayItems.map(
      (item) =>
        `- ${item.name} ${item.quantity} ${item.unit}，预计过期 ${new Date(
          item.expiryAt
        ).toLocaleDateString()}`
    );
    return `现有食材清单：\n${lines.join("\n")}`;
  };

  const handleGenerateRecipe = async () => {
    setRecipeMessage("");
    setIsGeneratingRecipe(true);
    try {
      if (!displayItems.length) {
        throw new Error("当前没有库存，无法生成食谱。");
      }
      const response = await fetch("/api/ai/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: buildRecipeInput(),
          memory: {},
        }),
      });
      const payload = (await response.json()) as {
        result?: RecipeResult;
        error?: string;
      };
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "生成失败");
      }
      setRecipeResult(payload.result ?? null);
      setRecipeMessage("已生成推荐食谱。");
    } catch (err) {
      setRecipeResult(null);
      setRecipeMessage(
        err instanceof Error ? err.message : "生成失败，请稍后重试。"
      );
    } finally {
      setIsGeneratingRecipe(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-8 text-amber-200/70">
        正在加载库存以生成食谱...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-8 text-rose-300">
        {error.message}
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-amber-200">食谱推荐</h2>
        <span className="text-xs text-amber-200/70">购买链接：暂无</span>
      </div>
      <p className="text-sm text-amber-100/70">
        基于当前库存生成多份可选料理建议。
      </p>
      <button
        className="w-full rounded-2xl bg-orange-400/90 px-4 py-3 text-sm font-semibold text-slate-900 disabled:opacity-50"
        onClick={handleGenerateRecipe}
        disabled={isGeneratingRecipe}
      >
        {isGeneratingRecipe ? "生成中..." : "生成推荐食谱"}
      </button>
      {recipeMessage ? (
        <p className="text-sm text-amber-100/70">{recipeMessage}</p>
      ) : null}
      {recipeResult?.recipes?.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {recipeResult.recipes.map((recipe: RecipeSuggestion, index) => (
            <div
              key={`${recipe.title}-${index}`}
              className="rounded-2xl border border-amber-500/30 bg-slate-950/60 p-4 space-y-3 text-sm text-slate-200"
            >
              <div className="flex flex-wrap items-center gap-3 text-amber-100">
                <span className="font-semibold">{recipe.title}</span>
                {recipe.servings ? (
                  <span className="text-xs text-amber-200/70">
                    份量：{recipe.servings}
                  </span>
                ) : null}
                {recipe.cookTimeMinutes ? (
                  <span className="text-xs text-amber-200/70">
                    用时：{recipe.cookTimeMinutes} 分钟
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-amber-200/70">
                使用食材：{recipe.usedItems.join("、")}
              </div>
              {recipe.missingItems?.length ? (
                <div className="text-xs text-amber-200/70">
                  可能缺少：{recipe.missingItems.join("、")}
                </div>
              ) : null}
              <ol className="list-decimal space-y-1 pl-4 text-xs text-amber-100/70">
                {recipe.steps.map((step, stepIndex) => (
                  <li key={`${step}-${stepIndex}`}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
