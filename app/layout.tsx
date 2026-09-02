import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";

export const metadata: Metadata = {
  title: "タスク管理 | Missions",
  description: "クライアント別・プロジェクト別のタスク管理アプリ",
  // 通知・PWA まわりでブラウザが参照するアプリ名（manifest.ts と揃える）。
  applicationName: "タスク管理",
  appleWebApp: { title: "タスク管理" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
