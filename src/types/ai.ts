export type RestockSource = "receipt" | "fridge_photo" | "manual";

export type RestockItem = {
  name: string;
  quantity: number;
  unit: string;
  expiryAt: string;
  confidence: number;
  source: RestockSource;
};

export type RestockResult = {
  items: RestockItem[];
  need_clarification: boolean;
  clarification_questions?: string[];
};

export type RecipeSuggestion = {
  title: string;
  steps: string[];
  usedItems: string[];
  missingItems?: string[];
  servings?: number;
  cookTimeMinutes?: number;
};

export type RecipeResult = {
  recipes: RecipeSuggestion[];
  need_clarification: boolean;
  clarification_questions?: string[];
};

export type MemoryField =
  | "dietaryRestrictions"
  | "allergies"
  | "favoriteCuisines"
  | "dislikedIngredients"
  | "skillLevel"
  | "calorieGoal"
  | "cookingTimePreference"
  | "householdSize"
  | "equipment";

export type MemoryProfile = {
  dietaryRestrictions?: string[];
  allergies?: string[];
  favoriteCuisines?: string[];
  dislikedIngredients?: string[];
  skillLevel?: "beginner" | "intermediate" | "advanced";
  calorieGoal?: string;
  cookingTimePreference?: string;
  householdSize?: number;
  equipment?: string[];
};

export type MemoryPatchUpdate = {
  field: MemoryField;
  op: "set" | "add" | "remove";
  value: string | number | string[];
  confidence: number;
  rationale?: string;
  source_text?: string;
};

export type MemoryPatch = {
  updates: MemoryPatchUpdate[];
};

export type MemoryHistoryEntry = {
  id: string;
  createdAt: string;
  updates: MemoryPatchUpdate[];
  before: MemoryProfile;
  after: MemoryProfile;
  source: "auto" | "explicit";
};
