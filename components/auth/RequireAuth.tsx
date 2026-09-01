"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { FullPageLoader } from "@/components/ui/loader";
import type { Role } from "@/types";

/**
 * ログイン必須のルートをラップするガード。
 * - 未ログインなら /login へリダイレクト。
 * - allowedRoles 指定時は、当該ロール以外を弾く（UI レベルの制御）。
 *   ※ データアクセスの最終防御はセキュリティルール（Phase 2）。
 */
export function RequireAuth({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: Role[];
}) {
  const { appUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !appUser) {
      router.replace("/login");
    }
  }, [loading, appUser, router]);

  if (loading) return <FullPageLoader label="読み込み中..." />;
  if (!appUser) return <FullPageLoader label="ログインページへ移動中..." />;

  if (allowedRoles && !allowedRoles.includes(appUser.role)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
        <p className="text-lg font-semibold">アクセス権限がありません</p>
        <p className="text-sm text-muted-foreground">
          この画面を表示する権限がありません。管理者にお問い合わせください。
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
