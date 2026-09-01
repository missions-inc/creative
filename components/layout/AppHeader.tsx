"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { canManageClients } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/types";

const NAV = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/projects", label: "プロジェクト" },
];

/** アプリ共通ヘッダー。ナビゲーション・ユーザー名・ロール・ログアウト。 */
export function AppHeader() {
  const { appUser, signOut } = useAuth();
  const pathname = usePathname();

  const items = canManageClients(appUser?.role)
    ? [...NAV, { href: "/clients", label: "クライアント" }]
    : NAV;

  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-semibold">
            タスク管理
          </Link>
          <nav className="flex items-center gap-4">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm transition-colors hover:text-foreground",
                  pathname.startsWith(item.href)
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {appUser ? (
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">
                {appUser.displayName ?? appUser.email}
              </p>
              <p className="text-xs leading-tight text-muted-foreground">
                {appUser.email} ・ {ROLE_LABELS[appUser.role]}
              </p>
            </div>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            <LogOut />
            ログアウト
          </Button>
        </div>
      </div>
    </header>
  );
}
