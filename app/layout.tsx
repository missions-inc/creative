import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "タスク管理 | Missions",
  description: "クライアント別・プロジェクト別のタスク管理アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
