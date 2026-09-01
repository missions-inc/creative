"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { ROLE_LABELS } from "@/types";

export default function DashboardPage() {
  const { appUser } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ようこそ、{appUser?.displayName ?? appUser?.email} さん
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          あなたのアカウント
        </h2>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">メール</dt>
            <dd className="font-medium">{appUser?.email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">ロール</dt>
            <dd className="font-medium">
              {appUser ? ROLE_LABELS[appUser.role] : "-"}
            </dd>
          </div>
        </dl>
      </div>

      <p className="text-sm text-muted-foreground">
        クライアント／プロジェクト／タスクの一覧・作成は後続フェーズ（Phase 3・4）で実装します。
      </p>
    </div>
  );
}
