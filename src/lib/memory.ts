import type {
  MemoryField,
  MemoryHistoryEntry,
  MemoryPatch,
  MemoryPatchUpdate,
  MemoryProfile,
} from "../types/ai";

export type MemoryPatchOptions = {
  confidenceThreshold?: number;
  source?: "auto" | "explicit";
};

const SENSITIVE_FIELDS: MemoryField[] = ["allergies"];
const DEFAULT_THRESHOLD = 0.6;

const isSensitiveField = (field: MemoryField): boolean =>
  SENSITIVE_FIELDS.includes(field);

const cloneProfile = (profile: MemoryProfile): MemoryProfile =>
  JSON.parse(JSON.stringify(profile ?? {})) as MemoryProfile;

export const filterMemoryPatch = (
  patch: MemoryPatch,
  options: MemoryPatchOptions = {}
): MemoryPatch => {
  const threshold = options.confidenceThreshold ?? DEFAULT_THRESHOLD;
  const updates =
    patch?.updates?.filter((update) => {
      if (!update) return false;
      if (update.confidence < threshold) return false;
      if (isSensitiveField(update.field) && options.source === "auto") {
        return false;
      }
      return true;
    }) ?? [];
  return { updates };
};

const applyUpdate = (
  profile: MemoryProfile,
  update: MemoryPatchUpdate
): void => {
  const field = update.field;
  const current = profile[field];
  switch (update.op) {
    case "set":
      profile[field] = update.value as never;
      break;
    case "add": {
      const next = Array.isArray(current) ? current.slice() : [];
      if (Array.isArray(update.value)) {
        update.value.forEach((item) => next.push(item));
      } else {
        next.push(update.value as string);
      }
      profile[field] = next as never;
      break;
    }
    case "remove": {
      if (!Array.isArray(current)) return;
      const toRemove = Array.isArray(update.value)
        ? update.value.map(String)
        : [String(update.value)];
      profile[field] = current.filter(
        (item) => !toRemove.includes(String(item))
      ) as never;
      break;
    }
    default:
      break;
  }
};

export const applyMemoryPatch = (
  profile: MemoryProfile,
  patch: MemoryPatch,
  options: MemoryPatchOptions = {}
): { profile: MemoryProfile; history?: MemoryHistoryEntry } => {
  const filtered = filterMemoryPatch(patch, options);
  if (!filtered.updates.length) {
    return { profile };
  }

  const before = cloneProfile(profile);
  const next = cloneProfile(profile);
  filtered.updates.forEach((update) => applyUpdate(next, update));

  const history: MemoryHistoryEntry = {
    id: `mem_${Date.now()}`,
    createdAt: new Date().toISOString(),
    updates: filtered.updates,
    before,
    after: next,
    source: options.source ?? "auto",
  };

  return { profile: next, history };
};
