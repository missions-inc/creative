"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";

import { subscribeForegroundMessages } from "@/lib/firebase/messaging";

interface Toast {
  id: number;
  title: string;
  body: string;
  url?: string;
}

/**
 * フォアグラウンド受信の表示。
 * タブを開いている間はブラウザが通知を出さないため、アプリ側で表示する。
 * （バックグラウンドは Service Worker + FCM SDK が自動表示する）
 */
export function ForegroundNotifications() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const router = useRouter();

  useEffect(() => {
    let nextId = 1;
    const unsubscribe = subscribeForegroundMessages((payload) => {
      const n = payload.notification;
      const data = payload.data ?? {};
      const toast: Toast = {
        id: nextId++,
        title: n?.title ?? "新しい通知",
        body: n?.body ?? "",
        url: data.taskId ? `/tasks/${data.taskId}` : undefined,
      };
      setToasts((prev) => [...prev, toast]);
      // 一定時間で自動的に消す。
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== toast.id)),
        8000,
      );
    });
    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="rounded-lg border bg-card p-3 shadow-lg"
          role="status"
        >
          <div className="flex items-start gap-2">
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.body ? (
                <p className="mt-0.5 break-words text-sm text-muted-foreground">
                  {t.body}
                </p>
              ) : null}
              {t.url ? (
                <button
                  className="mt-1 text-xs text-primary underline-offset-2 hover:underline"
                  onClick={() => {
                    setToasts((prev) => prev.filter((x) => x.id !== t.id));
                    router.push(t.url!);
                  }}
                >
                  タスクを開く
                </button>
              ) : null}
            </div>
            <button
              aria-label="閉じる"
              className="text-muted-foreground hover:text-foreground"
              onClick={() =>
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
              }
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
