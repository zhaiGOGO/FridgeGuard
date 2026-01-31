"use client";

import { useMemo, useState } from "react";

import { db } from "@/lib/db";

import {
  getStatus,
  groupDisplayItems,
  statusClass,
  statusLabel,
} from "./inventory-helpers";
import { useUser } from "./app-shell";

export default function InventoryPanel() {
  const { id: userId } = useUser();
  const { isLoading, error, data } = db.useQuery({
    foodItems: {
      $: {
        order: { expiryAt: "asc" },
        where: { "owner.id": userId },
      },
    },
  });

  const [isClearing, setIsClearing] = useState(false);
  const [clearMessage, setClearMessage] = useState("");
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const foodItems = data?.foodItems ?? [];
  const visibleItems = useMemo(
    () => foodItems.filter((item) => item.consumedAt == null),
    [foodItems]
  );
  const displayItems = useMemo(
    () => groupDisplayItems(visibleItems),
    [visibleItems]
  );
  const grouped = useMemo(() => {
    const groups: Record<string, typeof displayItems> = {
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

  const handleConsume = (itemId: string, itemIds: string[]) => {
    if (removingIds.has(itemId)) return;
    setRemovingIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
    const consumedAt = Date.now();
    window.setTimeout(() => {
      void (async () => {
        try {
          const txs = itemIds.map((id) =>
            db.tx.foodItems[id].update({ consumedAt })
          );
          await db.transact(txs);
        } catch (err) {
          setRemovingIds((prev) => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
          window.alert(
            err instanceof Error ? err.message : "标记失败，请稍后重试。"
          );
        }
      })();
    }, 200);
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
      <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 text-slate-400">
        正在加载库存...
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
    <section className="space-y-6">
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
                    className={`relative rounded-2xl border border-slate-800 bg-slate-950/60 p-4 transition-all duration-200 ease-out ${
                      removingIds.has(item.id)
                        ? "scale-95 opacity-0 pointer-events-none"
                        : "scale-100 opacity-100"
                    }`}
                  >
                    <button
                      type="button"
                      className="absolute right-3 top-3 rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300 transition hover:border-rose-400/60 hover:text-rose-200 disabled:opacity-50"
                      aria-label="设为已食用并移除"
                      onClick={() => handleConsume(item.id, item.itemIds)}
                      disabled={removingIds.has(item.id)}
                    >
                      ×
                    </button>
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
                    <label className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-400"
                        onChange={() => handleConsume(item.id, item.itemIds)}
                        disabled={removingIds.has(item.id)}
                      />
                      设为已食用
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
        <h3 className="text-lg font-semibold">库存管理</h3>
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
    </section>
  );
}
