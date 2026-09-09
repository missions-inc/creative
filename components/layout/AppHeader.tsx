"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { canManageClients } from "@/lib/auth/roles";
import { DASHBOARD_TABS, dashboardTabHref } from "@/lib/dashboard-tabs";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/types";

const TRASH_NAV = { href: "/trash", label: "ゴミ箱" };
const SETTINGS_NAV = { href: "/settings", label: "設定" };

/**
 * アプリ共通ヘッダー。
 * 「ダッシュボード」はホバー／キーボード（Enter・矢印・Esc）で開く
 * ドロップダウンになっており、各タブ（期日間近・マイタスク・クライアント別）を
 * 直接開ける（Radix NavigationMenu によるアクセシビリティ対応）。
 */
export function AppHeader() {
  const { appUser, signOut } = useAuth();
  const pathname = usePathname();

  const items = canManageClients(appUser?.role)
    ? [
        { href: "/projects", label: "プロジェクト" },
        { href: "/clients", label: "クライアント" },
        { href: "/members", label: "メンバー" },
        TRASH_NAV,
        SETTINGS_NAV,
      ]
    : [{ href: "/projects", label: "プロジェクト" }, TRASH_NAV, SETTINGS_NAV];

  const linkClass = (active: boolean) =>
    cn(
      "text-sm transition-colors hover:text-foreground rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      active ? "font-medium text-foreground" : "text-muted-foreground",
    );

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-semibold">
            タスク管理
          </Link>

          <NavigationMenu>
            <NavigationMenuList>
              {/* ダッシュボード: ホバー/キーボードで3タブのドロップダウン */}
              <NavigationMenuItem>
                <NavigationMenuTrigger
                  className={linkClass(pathname.startsWith("/dashboard"))}
                >
                  ダッシュボード
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul>
                    {DASHBOARD_TABS.map((tab) => (
                      <li key={tab.value}>
                        <NavigationMenuLink asChild>
                          <Link
                            href={dashboardTabHref(tab.value)}
                            className="block rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none"
                          >
                            {tab.label}
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>

              {items.map((item) => (
                <NavigationMenuItem key={item.href}>
                  <NavigationMenuLink asChild>
                    <Link
                      href={item.href}
                      className={linkClass(pathname.startsWith(item.href))}
                    >
                      {item.label}
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
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
