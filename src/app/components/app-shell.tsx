"use client";

import { createContext, useContext, type ReactNode } from "react";

import { db } from "@/lib/db";

import LoginView from "./login-view";
import TopNav from "./top-nav";

type UserContextValue = {
  id: string;
};

const UserContext = createContext<UserContextValue | null>(null);

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser 必须在 AppShell 内使用。");
  }
  return ctx;
};

export default function AppShell({ children }: { children: ReactNode }) {
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

        {user ? <TopNav /> : null}

        {!user ? (
          <LoginView />
        ) : (
          <UserContext.Provider value={{ id: user.id }}>
            {children}
          </UserContext.Provider>
        )}
      </div>
    </div>
  );
}
