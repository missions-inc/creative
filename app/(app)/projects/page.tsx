"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { ProjectDialog } from "@/components/projects/ProjectDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/loader";
import { useClients, useProjects, useUsers } from "@/hooks/useCollections";
import { canManageProjects } from "@/lib/auth/roles";
import { createProject } from "@/lib/firebase/mutations";
import { describeVisibility } from "@/types";

export default function ProjectsPage() {
  const { appUser } = useAuth();
  const { data: projects, loading, error } = useProjects();
  const { data: clients } = useClients();
  const { data: users } = useUsers();
  const [creating, setCreating] = useState(false);

  const canManage = canManageProjects(appUser?.role);
  const clientNameById = useMemo(
    () => new Map(clients.map((c) => [c.id, c.name])),
    [clients],
  );

  // クライアント別にグルーピングして表示（§3.9 の階層表示の土台）。
  const grouped = useMemo(() => {
    const map = new Map<string, typeof projects>();
    for (const p of projects) {
      const list = map.get(p.clientId) ?? [];
      list.push(p);
      map.set(p.clientId, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) =>
      (clientNameById.get(a) ?? "").localeCompare(clientNameById.get(b) ?? ""),
    );
  }, [projects, clientNameById]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">プロジェクト</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            アクセスできるプロジェクトのみ表示されます。
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => setCreating(true)}>
            <Plus />
            新規プロジェクト
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          読み込みに失敗しました: {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">
            表示できるプロジェクトがありません。
          </p>
          {canManage ? (
            <Button className="mt-4" onClick={() => setCreating(true)}>
              <Plus />
              プロジェクトを作成
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-6">
          {/* クライアントへのアンカーリンク（アクセス可能なプロジェクトを持つクライアントのみ）。
              クライアントが多くても折り返して収まるチップ型レイアウト。 */}
          {grouped.length > 1 ? (
            <nav
              aria-label="クライアントへ移動"
              className="flex flex-wrap gap-1.5"
            >
              {grouped.map(([clientId]) => (
                <a
                  key={clientId}
                  href={`#client-${clientId}`}
                  onClick={(e) => {
                    // スムーズスクロール（ヘッダー分のオフセットは scroll-mt で確保）。
                    e.preventDefault();
                    document
                      .getElementById(`client-${clientId}`)
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="rounded-full border bg-background px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {clientNameById.get(clientId) ?? "（不明なクライアント）"}
                </a>
              ))}
            </nav>
          ) : null}

          {grouped.map(([clientId, list]) => (
            <section
              key={clientId}
              id={`client-${clientId}`}
              // 固定ヘッダー（h-14 = 56px）に見出しが隠れないようオフセットを確保。
              className="scroll-mt-20 space-y-3"
            >
              {/* クライアント > プロジェクトの階層が一目で分かるよう、見出しを大きく + 緑マーカー */}
              <h2 className="flex items-center gap-2.5 border-b pb-2 text-xl font-bold">
                <span
                  aria-hidden
                  className="h-3 w-3 shrink-0 rounded-full bg-green-500"
                />
                {clientNameById.get(clientId) ?? "（不明なクライアント）"}
              </h2>
              <div className="space-y-2">
                {list.map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="block">
                    <Card className="transition-colors hover:bg-accent/50">
                      <CardContent className="flex items-center justify-between gap-4 p-4">
                        <p className="truncate font-medium">{p.name}</p>
                        <Badge variant="outline">
                          {describeVisibility(p.visibility)}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ProjectDialog
        open={creating}
        onOpenChange={setCreating}
        title="新規プロジェクト"
        clients={clients}
        users={users}
        onSubmit={async (v) => {
          await createProject(v);
        }}
      />
    </div>
  );
}
