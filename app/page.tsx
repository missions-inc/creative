"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { FullPageLoader } from "@/components/ui/loader";

/** ルート: 認証状態に応じてダッシュボード / ログインへ振り分ける。 */
export default function Home() {
  const { appUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(appUser ? "/dashboard" : "/login");
  }, [loading, appUser, router]);

  return <FullPageLoader label="読み込み中..." />;
}
