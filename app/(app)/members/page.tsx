"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUsers } from "@/hooks/useCollections";
import { formatDate } from "@/lib/date";
import { updateUserRole } from "@/lib/firebase/mutations";
import {
  ALLOWED_EMAIL_DOMAIN,
  BOOTSTRAP_ADMIN_EMAIL,
} from "@/lib/firebase/config";
import { ROLES, ROLE_LABELS, type Role } from "@/types";

export default function MembersPage() {
  // メンバー管理・権限変更は admin のみ（§3.2）。
  return (
    <RequireAuth allowedRoles={["admin"]}>
      <MembersView />
    </RequireAuth>
  );
}

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "メンバー招待・権限変更、クライアント登録、全プロジェクト/タスクの全操作",
  pm: "プロジェクトの作成・編集・削除、アクセス可能範囲内の全タスク管理",
  member: "タスクの作成・編集・ステータス変更・コメント投稿（公開範囲内のみ）",
};

function MembersView() {
  const { appUser } = useAuth();
  const { data: users, loading, error } = useUsers();
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [message, setMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);

  const adminCount = useMemo(
    () => users.filter((u) => u.role === "admin").length,
    [users],
  );

  const changeRole = async (uid: string, current: Role, next: Role) => {
    if (current === next) return;

    // 最後の admin を降格させると誰も権限管理できなくなるため UI で保護する。
    if (current === "admin" && adminCount <= 1) {
      setMessage({
        kind: "error",
        text: "最後の管理者は降格できません。先に別のメンバーを管理者にしてください。",
      });
      return;
    }

    setBusyUid(uid);
    setMessage(null);
    try {
      await updateUserRole(uid, next);
      const user = users.find((u) => u.uid === uid);
      setMessage({
        kind: "ok",
        text: `${user?.displayName ?? user?.email ?? uid} のロールを「${ROLE_LABELS[next]}」に変更しました。`,
      });
    } catch (e) {
      setMessage({
        kind: "error",
        text:
          e instanceof Error
            ? `変更に失敗しました: ${e.message}`
            : "変更に失敗しました。",
      });
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Users className="h-6 w-6" />
          メンバー管理
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          メンバーのロール（権限）を変更できます（管理者のみ）。
        </p>
      </div>

      {/* 招待の案内: ドメイン制限ログインのため、URL を共有するだけでよい */}
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">メンバーの招待について</p>
          <p className="mt-1">
            {ALLOWED_EMAIL_DOMAIN} の Google アカウントを持つ人がこのアプリの URL
            からログインすると、自動的に「{ROLE_LABELS.member}」として登録されます。
            招待はアプリの URL を共有するだけで完了します。必要に応じてこの画面でロールを引き上げてください。
          </p>
        </CardContent>
      </Card>

      {message ? (
        <p
          role="status"
          className={
            message.kind === "ok" ? "text-sm text-green-700" : "text-sm text-destructive"
          }
        >
          {message.text}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          読み込みに失敗しました: {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const isSelf = u.uid === appUser?.uid;
            const isBootstrapAdmin =
              u.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
            const lastAdmin = u.role === "admin" && adminCount <= 1;
            return (
              <Card key={u.uid}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">
                        {u.displayName ?? u.email}
                      </p>
                      {isSelf ? <Badge variant="secondary">自分</Badge> : null}
                      {isBootstrapAdmin ? (
                        <Badge variant="outline">初期管理者</Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {u.email} ・ 登録日: {formatDate(u.createdAt)}
                    </p>
                  </div>

                  <div className="shrink-0 sm:w-44">
                    <Select
                      value={u.role}
                      disabled={busyUid === u.uid || lastAdmin}
                      onValueChange={(v) => changeRole(u.uid, u.role, v as Role)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {lastAdmin ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        最後の管理者のため変更不可
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-semibold text-muted-foreground">
            ロールと権限（仕様 §3.2）
          </p>
          <dl className="space-y-2 text-sm">
            {ROLES.map((r) => (
              <div key={r} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="w-20 shrink-0 font-medium">{ROLE_LABELS[r]}</dt>
                <dd className="text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
