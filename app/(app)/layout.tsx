import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppHeader } from "@/components/layout/AppHeader";
import { ForegroundNotifications } from "@/components/notifications/ForegroundNotifications";

/** ログイン必須エリアの共通レイアウト（ヘッダー + 認証ガード）。 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <RequireAuth>
      <div className="min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <ForegroundNotifications />
      </div>
    </RequireAuth>
  );
}
