"use client";

import { useCallback, useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { Bell, BellOff, CheckCircle2, Send, XCircle } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/loader";
import { getFirebaseFunctions } from "@/lib/firebase/client";
import {
  disableNotifications,
  enableNotifications,
  getPermissionState,
  type PermissionState,
} from "@/lib/firebase/messaging";

/**
 * 呼び出し可能関数のエラーを、原因の切り分けができる文言に変換する。
 *
 * 特に `internal` は「関数に到達できていない」ときにも出るため要注意
 * （未デプロイ / リージョン不一致 / Cloud Run の invoker 権限不足など）。
 * この場合は関数側のログにも何も残らない。
 */
function describeCallableError(e: unknown): string {
  const err = e as { code?: string; message?: string };
  const code = err.code ?? "";
  const detail = err.message ? `（${err.message}）` : "";

  switch (code) {
    case "functions/unauthenticated":
      return "ログイン状態が確認できませんでした。再度ログインしてお試しください。";
    case "functions/permission-denied":
      return `権限がありません${detail}`;
    case "functions/failed-precondition":
      return `${err.message ?? "先に「この端末で通知を有効にする」を実行してください。"}`;
    case "functions/not-found":
      return "通知機能（Cloud Functions）が見つかりません。デプロイが完了しているか、リージョン設定が一致しているかご確認ください。";
    case "functions/internal":
      return "通知機能に接続できませんでした。Cloud Functions が未デプロイか、関数の呼び出し権限（Cloud Run invoker）が付与されていない可能性があります。README の「通知が動かないときの切り分け」をご確認ください。";
    default:
      return `テスト送信に失敗しました${detail || `（${code || "原因不明"}）`}`;
  }
}

/**
 * 通知の設定・疎通確認（仕様書 §6）。
 *
 * Chrome の通知は各ユーザーのローカル設定（OS の通知許可・Chrome の起動状態・
 * 集中モード）に依存する。届かないときの切り分けができるよう、
 * 現在の許可状態の表示とテスト送信ボタンを用意する。
 */
export function NotificationSettings() {
  const { appUser } = useAuth();
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);

  const refresh = useCallback(async () => {
    setPermission(await getPermissionState());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onEnable = async () => {
    if (!appUser) return;
    setBusy(true);
    setMessage(null);
    try {
      const t = await enableNotifications(appUser.uid);
      if (t) {
        setToken(t);
        setMessage({ kind: "ok", text: "この端末の通知を有効にしました。" });
      } else {
        setMessage({
          kind: "error",
          text: "通知が許可されませんでした。ブラウザの設定を確認してください。",
        });
      }
    } catch (e) {
      setMessage({
        kind: "error",
        text: e instanceof Error ? e.message : "通知の有効化に失敗しました。",
      });
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const onDisable = async () => {
    if (!appUser || !token) return;
    setBusy(true);
    setMessage(null);
    try {
      await disableNotifications(appUser.uid, token);
      setToken(null);
      setMessage({ kind: "ok", text: "この端末の通知を無効にしました。" });
    } catch (e) {
      setMessage({
        kind: "error",
        text: e instanceof Error ? e.message : "通知の無効化に失敗しました。",
      });
    } finally {
      setBusy(false);
    }
  };

  const onTest = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const fn = httpsCallable<void, { tokens: number; success: number; failure: number }>(
        getFirebaseFunctions(),
        "sendTestNotification",
      );
      const res = await fn();
      const { tokens, success, failure } = res.data;
      setMessage(
        success > 0
          ? {
              kind: "ok",
              text: `テスト通知を送信しました（登録端末 ${tokens} 件中 ${success} 件成功）。数秒待っても表示されない場合は、OS の通知設定や集中モードをご確認ください。`,
            }
          : {
              kind: "error",
              text: `送信できませんでした（登録端末 ${tokens} 件・失敗 ${failure} 件）。通知を有効にし直してください。`,
            },
      );
    } catch (e) {
      setMessage({ kind: "error", text: describeCallableError(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">プッシュ通知</h2>
          <PermissionBadge state={permission} />
        </div>

        <p className="text-sm text-muted-foreground">
          タスクの割り当て・完了、および毎朝 9:00 の期日リマインド（期日の 2 日前と当日）を
          この端末へ通知します。
        </p>

        {permission === "unsupported" ? (
          <p className="text-sm text-destructive">
            このブラウザは Web プッシュ通知に対応していません。PC の Chrome をご利用ください。
          </p>
        ) : null}

        {permission === "denied" ? (
          <p className="text-sm text-destructive">
            通知がブロックされています。アドレスバー左のアイコンから
            このサイトの通知を「許可」に変更してから、再度お試しください。
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onEnable}
            disabled={busy || permission === "unsupported" || permission === "denied"}
          >
            {busy ? <Spinner /> : <Bell />}
            この端末で通知を有効にする
          </Button>

          <Button variant="outline" onClick={onTest} disabled={busy}>
            {busy ? <Spinner /> : <Send />}
            通知テスト送信
          </Button>

          {token ? (
            <Button variant="ghost" onClick={onDisable} disabled={busy}>
              <BellOff />
              この端末の通知を無効にする
            </Button>
          ) : null}
        </div>

        {message ? (
          <p
            role="status"
            className={
              message.kind === "ok"
                ? "text-sm text-green-700"
                : "text-sm text-destructive"
            }
          >
            {message.text}
          </p>
        ) : null}

        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          <p className="font-medium">通知が届かないときの確認ポイント</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            <li>対象は PC の Chrome のみです（iPhone は対象外）</li>
            <li>OS 側（Mac / Windows）の通知が Chrome に許可されているか</li>
            <li>集中モード（おやすみモード）が有効になっていないか</li>
            <li>Chrome が起動しているか（完全に終了していると届きません）</li>
            <li>端末ごとに有効化が必要です。別の PC でも使う場合はそちらでも設定してください</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function PermissionBadge({ state }: { state: PermissionState | null }) {
  if (state === null) return <Badge variant="secondary">確認中...</Badge>;
  if (state === "granted")
    return (
      <Badge variant="success">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        許可済み
      </Badge>
    );
  if (state === "denied")
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" />
        ブロック中
      </Badge>
    );
  if (state === "unsupported")
    return <Badge variant="secondary">非対応ブラウザ</Badge>;
  return <Badge variant="mid">未設定</Badge>;
}
