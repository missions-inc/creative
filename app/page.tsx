export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">タスク管理アプリ</h1>
      <p className="text-muted-foreground">
        Phase 0: プロジェクト初期化が完了しました。
      </p>
      <p className="text-sm text-muted-foreground">
        認証・ダッシュボードは後続フェーズで実装します。
      </p>
    </main>
  );
}
