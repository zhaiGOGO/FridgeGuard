import { type AppSchema } from "@/instant.schema";
import type { RestockItem } from "@/types/ai";
import { type InstaQLEntity } from "@instantdb/react";

export type FoodItem = InstaQLEntity<AppSchema, "foodItems">;

export type DisplayItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  expiryAt: number;
  confidence: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const parseExpiry = (expiryAt: string): number => {
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

export const normalizeName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, " ");

export const expiryKey = (expiryAt: number): string =>
  new Date(expiryAt).toISOString().slice(0, 10);

export const getStatus = (expiryAt: number) => {
  const diff = expiryAt - Date.now();
  if (diff < 0) return "expired";
  if (diff <= 3 * DAY_MS) return "use_soon";
  return "fresh";
};

export const statusLabel = {
  fresh: "新鲜",
  use_soon: "尽快食用",
  expired: "临期/过期",
} as const;

export const statusClass = {
  fresh: "bg-emerald-500/15 text-emerald-600",
  use_soon: "bg-amber-500/15 text-amber-600",
  expired: "bg-rose-500/15 text-rose-600",
} as const;

export const groupDisplayItems = (items: FoodItem[]): DisplayItem[] => {
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

export const findMatch = (
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
