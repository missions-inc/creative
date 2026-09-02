"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * ルート直下のエラーバウンダリ。
 * 予期しない例外で画面が真っ白になるのを防ぎ、再試行の導線を出す。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 調査用にコンソールへは残す（画面には内部詳細を出さない）。
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <h1 className="text-xl font-semibold">エラーが発生しました</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        予期しない問題が発生しました。再試行しても解決しない場合は、
        時間をおいてから再度アクセスするか、管理者にお問い合わせください。
      </p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">エラーID: {error.digest}</p>
      ) : null}
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        再試行
      </button>
    </main>
  );
}
