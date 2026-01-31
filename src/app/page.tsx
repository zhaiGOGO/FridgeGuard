"use client";

import { type ChangeEvent, useMemo, useState } from "react";

import { type AppSchema } from "@/instant.schema";
import { db } from "@/lib/db";
import type { RecipeResult, RecipeSuggestion, RestockItem, RestockResult } from "@/types/ai";
import { id, InstaQLEntity } from "@instantdb/react";

type FoodItem = InstaQLEntity<AppSchema, "foodItems">;
type DisplayItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  expiryAt: number;
  confidence: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const parseExpiry = (expiryAt: string): number => {
  const parsed = Date.parse(expiryAt);
  if (Number.isNaN(parsed)) {
    return Date.now() + 3 * DAY_MS;
  }

  const now = Date.now();
  const sixMonthsAgo = now - 180 * DAY_MS;
  if (parsed < sixMonthsAgo) {
    const match = expiryAt.match(/(\d{4})/);
    const year = match ? Number(match[1]) : NaN;
    const currentYear = new Date().getFullYear();
    if (!Number.isNaN(year) && year < currentYear) {
      const bumped = new Date(parsed);
      bumped.setFullYear(currentYear);
      if (!Number.isNaN(bumped.getTime())) {
        return bumped.getTime();
      }
    }
  }

  return parsed;
};

const normalizeName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, " ");

const expiryKey = (expiryAt: number): string =>
  new Date(expiryAt).toISOString().slice(0, 10);

const getStatus = (expiryAt: number) => {
  const diff = expiryAt - Date.now();
  if (diff < 0) return "expired";
  if (diff <= 3 * DAY_MS) return "use_soon";
  return "fresh";
};

const statusLabel = {
  fresh: "新鲜",
  use_soon: "尽快食用",
  expired: "临期/过期",
} as const;

const statusClass = {
  fresh: "bg-emerald-500/15 text-emerald-600",
  use_soon: "bg-amber-500/15 text-amber-600",
  expired: "bg-rose-500/15 text-rose-600",
} as const;

const groupDisplayItems = (items: FoodItem[]): DisplayItem[] => {
  const grouped = new Map<string, DisplayItem>();
  items.forEach((item) => {
    const key = `${normalizeName(item.name)}|${item.unit}|${expiryKey(
      item.expiryAt
    )}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      existing.confidence = Math.max(existing.confidence, item.confidence);
      return;
    }
    grouped.set(key, {
      id: key,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      expiryAt: item.expiryAt,
      confidence: item.confidence,
    });
  });
  return Array.from(grouped.values()).sort((a, b) => a.expiryAt - b.expiryAt);
};

const findMatch = (
  candidate: RestockItem,
  existing: FoodItem[]
): FoodItem | undefined => {
  const normalized = normalizeName(candidate.name);
  const expiryAt = parseExpiry(candidate.expiryAt);
  return existing.find((item) => {
    if (normalizeName(item.name) !== normalized) return false;
    if (item.unit !== candidate.unit) return false;
    return Math.abs(item.expiryAt - expiryAt) <= DAY_MS;
  });
};

function LoginView() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSendCode = async () => {
    setAuthMessage("");
    setIsSending(true);
    try {
      await db.auth.sendMagicCode({ email });
      setAuthMessage("验证码已发送，请检查邮箱。");
    } catch (err) {
      setAuthMessage(
        err instanceof Error ? err.message : "发送失败，请稍后再试。"
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async () => {
    setAuthMessage("");
    setIsVerifying(true);
    try {
      await db.auth.signInWithMagicCode({ email, code });
      setAuthMessage("登录成功。");
    } catch (err) {
      setAuthMessage(
        err instanceof Error ? err.message : "登录失败，请检查验证码。"
      );
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="text-xl font-semibold">邮箱登录</h2>
      <p className="text-sm text-slate-400 mt-1">
        使用 InstantDB Magic Code 登录
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-[2fr_1fr]">
        <input
          className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
          placeholder="邮箱地址"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button
          className="rounded-xl bg-emerald-500/90 px-4 py-3 text-sm font-semibold text-slate-900 disabled:opacity-50"
          onClick={handleSendCode}
          disabled={!email || isSending}
        >
          {isSending ? "发送中..." : "发送验证码"}
        </button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr]">
        <input
          className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
          placeholder="验证码"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <button
          className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 disabled:opacity-50"
          onClick={handleVerify}
          disabled={!email || !code || isVerifying}
        >
          {isVerifying ? "验证中..." : "登录"}
        </button>
      </div>
      {authMessage ? (
        <p className="mt-3 text-sm text-slate-400">{authMessage}</p>
      ) : null}
    </section>
  );
}

function InventoryView({ userId }: { userId: string }) {
  const { isLoading, error, data } = db.useQuery({
    foodItems: {
      $: {
        order: { expiryAt: "asc" },
        where: { "owner.id": userId },
      },
    },
  });

  const [isRestocking, setIsRestocking] = useState(false);
  const [restockMessage, setRestockMessage] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [clearMessage, setClearMessage] = useState("");
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
  const [recipeMessage, setRecipeMessage] = useState("");
  const [recipeResult, setRecipeResult] = useState<RecipeResult | null>(null);

  const foodItems = data?.foodItems ?? [];
  const displayItems = useMemo(() => groupDisplayItems(foodItems), [foodItems]);
  const grouped = useMemo(() => {
    const groups: Record<string, DisplayItem[]> = {
      expired: [],
      use_soon: [],
      fresh: [],
    };
    displayItems.forEach((item) => {
      const status = getStatus(item.expiryAt);
      groups[status].push(item);
    });
    return groups;
  }, [displayItems]);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setImageDataUrl(null);
      setImageName(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(String(reader.result ?? ""));
      setImageName(file.name);
    };
    reader.onerror = () => {
      setRestockMessage("读取图片失败，请重试。");
      setImageDataUrl(null);
      setImageName(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRestock = async () => {
    setRestockMessage("");
    setIsRestocking(true);
    try {
      if (!imageDataUrl) {
        throw new Error("请先上传采购或冰箱照片。");
      }
      const response = await fetch("/api/ai/restock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: imageDataUrl }),
      });
      const payload = (await response.json()) as {
        result?: RestockResult;
        error?: string;
      };
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "识别失败");
      }
      const items = payload.result?.items ?? [];
      const txs = items.map((item) => {
        const matched = findMatch(item, foodItems);
        const expiryAt = parseExpiry(item.expiryAt);
        if (matched) {
          return db.tx.foodItems[matched.id].update({
            quantity: matched.quantity + item.quantity,
            confidence: Math.max(matched.confidence, item.confidence),
          });
        }
        return db.tx.foodItems[id()]
          .create({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            expiryAt,
            createdAt: Date.now(),
            source: item.source,
            confidence: item.confidence,
          })
          .link({ owner: userId });
      });
      if (txs.length) {
        await db.transact(txs);
      }
      setRestockMessage(`已入库 ${txs.length} 条记录（重复已合并）。`);
    } catch (err) {
      setRestockMessage(
        err instanceof Error ? err.message : "识别失败，请稍后重试。"
      );
    } finally {
      setIsRestocking(false);
    }
  };

  const buildRecipeInput = (items: DisplayItem[]): string => {
    const lines = items.map(
      (item) =>
        `- ${item.name} ${item.quantity} ${item.unit}，预计过期 ${new Date(item.expiryAt).toLocaleDateString()}`
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
          text: buildRecipeInput(displayItems),
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

  const handleClearInventory = async () => {
    if (!foodItems.length) {
      setClearMessage("当前没有可清空的库存。");
      return;
    }
    const confirmed = window.confirm("确定要清空你的库存吗？此操作不可撤销。");
    if (!confirmed) return;
    setClearMessage("");
    setIsClearing(true);
    try {
      const txs = foodItems.map((item) => db.tx.foodItems[item.id].delete());
      await db.transact(txs);
      setClearMessage("已清空当前账号的库存。");
    } catch (err) {
      setClearMessage(
        err instanceof Error ? err.message : "清空失败，请稍后重试。"
      );
    } finally {
      setIsClearing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        正在加载 FridgeGuard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-rose-500">
        {error?.message}
      </div>
    );
  }
  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_2fr]">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 space-y-6">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">拍照入库</h2>
          <p className="text-sm text-slate-400">
            上传采购清单或冰箱照片，由 Gemini 识别并入库。
          </p>
          <label className="block">
            <span className="text-xs text-slate-500">上传图片</span>
            <input
              type="file"
              accept="image/*"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:text-slate-200"
              onChange={handleImageChange}
            />
          </label>
          {imageName ? (
            <p className="text-xs text-slate-500">已选文件：{imageName}</p>
          ) : null}
          <button
            className="w-full rounded-2xl bg-indigo-500/90 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            onClick={handleRestock}
            disabled={isRestocking}
          >
            {isRestocking ? "识别中..." : "从图片识别入库"}
          </button>
          {restockMessage ? (
            <p className="text-sm text-slate-400">{restockMessage}</p>
          ) : null}
        </div>
        <button
          className="w-full rounded-2xl border border-rose-400/40 px-4 py-3 text-sm font-semibold text-rose-200 hover:border-rose-300 disabled:opacity-50"
          onClick={handleClearInventory}
          disabled={isClearing}
        >
          {isClearing ? "清空中..." : "清空我的库存"}
        </button>
        {clearMessage ? (
          <p className="text-sm text-slate-400">{clearMessage}</p>
        ) : null}
      </div>

      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">冰箱库存</h2>
            <span className="text-sm text-slate-400">
              {displayItems.length} 项（已合并展示）
            </span>
          </div>
          <div className="mt-6 space-y-5">
            {(["expired", "use_soon", "fresh"] as const).map((status) => (
              <div key={status} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${statusClass[status]}`}
                  >
                    {statusLabel[status]}
                  </span>
                  <span className="text-xs text-slate-500">
                    {grouped[status].length} 项
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {grouped[status].map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{item.name}</h3>
                        <span className="text-xs text-slate-400">
                          {item.quantity} {item.unit}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        预计过期：{new Date(item.expiryAt).toLocaleDateString()}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        置信度：{Math.round(item.confidence * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">食谱推荐</h2>
            <span className="text-xs text-slate-500">购买链接：暂无</span>
          </div>
          <p className="text-sm text-slate-400">
            基于当前库存生成多份可选料理建议。
          </p>
          <button
            className="w-full rounded-2xl bg-emerald-500/90 px-4 py-3 text-sm font-semibold text-slate-900 disabled:opacity-50"
            onClick={handleGenerateRecipe}
            disabled={isGeneratingRecipe}
          >
            {isGeneratingRecipe ? "生成中..." : "生成推荐食谱"}
          </button>
          {recipeMessage ? (
            <p className="text-sm text-slate-400">{recipeMessage}</p>
          ) : null}
          {recipeResult?.recipes?.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {recipeResult.recipes.map((recipe: RecipeSuggestion, index) => (
                <div
                  key={`${recipe.title}-${index}`}
                  className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3 text-sm text-slate-300"
                >
                  <div className="flex flex-wrap items-center gap-3 text-slate-200">
                    <span className="font-semibold">{recipe.title}</span>
                    {recipe.servings ? (
                      <span className="text-xs text-slate-500">
                        份量：{recipe.servings}
                      </span>
                    ) : null}
                    {recipe.cookTimeMinutes ? (
                      <span className="text-xs text-slate-500">
                        用时：{recipe.cookTimeMinutes} 分钟
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-500">
                    使用食材：{recipe.usedItems.join("、")}
                  </div>
                  {recipe.missingItems?.length ? (
                    <div className="text-xs text-slate-500">
                      可能缺少：{recipe.missingItems.join("、")}
                    </div>
                  ) : null}
                  <ol className="list-decimal space-y-1 pl-4 text-xs text-slate-400">
                    {recipe.steps.map((step, stepIndex) => (
                      <li key={`${step}-${stepIndex}`}>{step}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const { isLoading: authLoading, user, error: authError } = db.useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        正在加载 FridgeGuard...
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center text-rose-500">
        {authError.message}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-slate-400">
              FridgeGuard
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold">
              零浪费冰箱管家
            </h1>
            <p className="text-slate-400 mt-2">
              一键入库、保质期追踪、清库存建议。
            </p>
          </div>
          {user ? (
            <button
              className="rounded-full border border-slate-700 px-5 py-2 text-sm hover:border-slate-500"
              onClick={() => db.auth.signOut()}
            >
              退出登录
            </button>
          ) : null}
        </header>

        {!user ? <LoginView /> : <InventoryView userId={user.id} />}
      </div>
    </div>
  );
}
