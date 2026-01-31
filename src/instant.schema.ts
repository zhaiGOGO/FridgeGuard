// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
      imageURL: i.string().optional(),
      type: i.string().optional(),
    }),
    foodItems: i.entity({
      name: i.string().indexed(),
      quantity: i.number(),
      unit: i.string(),
      expiryAt: i.number().indexed(),
      createdAt: i.number().indexed(),
      source: i.string(),
      confidence: i.number(),
    }),
    userProfiles: i.entity({
      data: i.string(),
      updatedAt: i.number().indexed(),
    }),
    memoryHistory: i.entity({
      updates: i.string(),
      before: i.string(),
      after: i.string(),
      createdAt: i.number().indexed(),
      source: i.string(),
    }),
  },
  links: {
    $usersLinkedPrimaryUser: {
      forward: {
        on: "$users",
        has: "one",
        label: "linkedPrimaryUser",
        onDelete: "cascade",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "linkedGuestUsers",
      },
    },
    userFoodItems: {
      forward: {
        on: "foodItems",
        has: "one",
        label: "owner",
        onDelete: "cascade",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "foodItems",
      },
    },
    userProfile: {
      forward: {
        on: "userProfiles",
        has: "one",
        label: "user",
        onDelete: "cascade",
      },
      reverse: {
        on: "$users",
        has: "one",
        label: "profile",
      },
    },
    userMemoryHistory: {
      forward: {
        on: "memoryHistory",
        has: "one",
        label: "user",
        onDelete: "cascade",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "memoryHistory",
      },
    },
  },
});

// This helps TypeScript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
