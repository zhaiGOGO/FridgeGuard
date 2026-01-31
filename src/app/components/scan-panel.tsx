"use client";

import { type ChangeEvent, useState } from "react";

import { db } from "@/lib/db";
import type { RestockResult } from "@/types/ai";
import { id } from "@instantdb/react";

import { findMatch, parseExpiry } from "./inventory-helpers";
import { useUser } from "./app-shell";

export default function ScanPanel() {
  const { id: userId } = useUser();
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

  const foodItems = data?.foodItems ?? [];

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

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 text-slate-400">
        正在加载库存用于比对...
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
    <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">拍照入库</h2>
          <span className="text-xs text-slate-500">
            现有 {foodItems.length} 项库存
          </span>
        </div>
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
    </section>
  );
}
