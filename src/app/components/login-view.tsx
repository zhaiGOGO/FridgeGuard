"use client";

import { useState } from "react";

import { db } from "@/lib/db";

export default function LoginView() {
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
