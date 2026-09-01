"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/types";

/** アプリ共通ヘッダー。ユーザー名・ロール・ログアウトを表示。 */
export function AppHeader() {
  const { appUser, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/dashboard" className="font-semibold">
          タスク管理
        </Link>

        <div className="flex items-center gap-3">
          {appUser ? (
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">
                {appUser.displayName ?? appUser.email}
              </p>
              <p className="text-xs text-muted-foreground leading-tight">
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
