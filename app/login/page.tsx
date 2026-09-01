"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { FullPageLoader, Spinner } from "@/components/ui/loader";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/firebase/config";

export default function LoginPage() {
  const { appUser, loading, error, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // ログイン済みならダッシュボードへ。
  useEffect(() => {
    if (!loading && appUser) {
      router.replace("/dashboard");
    }
  }, [loading, appUser, router]);

  if (loading) return <FullPageLoader label="読み込み中..." />;
  if (appUser) return <FullPageLoader label="移動中..." />;

  const onSignIn = async () => {
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold">タスク管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            クライアント別・プロジェクト別タスク管理
          </p>
        </div>

        {error ? (
          <div
            role="alert"
            className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        <Button className="w-full" onClick={onSignIn} disabled={submitting}>
          {submitting ? <Spinner /> : null}
          Google でログイン
        </Button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {ALLOWED_EMAIL_DOMAIN} のアカウントのみ利用できます。
        </p>
      </div>
    </main>
  );
}
