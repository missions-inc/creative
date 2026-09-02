"use client";

import { NotificationSettings } from "@/components/notifications/NotificationSettings";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">設定</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          通知の有効化と動作確認ができます。
        </p>
      </div>

      <NotificationSettings />
    </div>
  );
}
