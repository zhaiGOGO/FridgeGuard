"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/inventory", label: "冰箱库存" },
  { href: "/scan", label: "拍照入库" },
  { href: "/recipes", label: "食谱推荐" },
] as const;

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export default function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="rounded-full border border-slate-800 bg-slate-950/70 p-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {navItems.map((item) => {
          const active = pathname ? isActive(pathname, item.href) : false;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-4 py-2 text-sm transition ${
                active
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
