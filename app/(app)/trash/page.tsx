"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RotateCcw, Trash2 } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/loader";
import { useClients, useProjects, useTasks } from "@/hooks/useCollections";
import { canManageClients, canManageProjects } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/date";
import {
  setClientDeleted,
  setProjectDeleted,
  setTaskDeleted,
} from "@/lib/firebase/mutations";

/** ゴミ箱の保持期間（日）。functions/src/purge.ts の TRASH_RETENTION_DAYS と一致させる。 */
const TRASH_RETENTION_DAYS = 30;

/**
 * ゴミ箱（仕様書 §3.8）。
 * 論理削除されたタスク・プロジェクト（admin はクライアントも）を一覧し、復元できる。
 * 30 日経過したものは毎日のバッチで完全削除される。
 */
export default function TrashPage() {
  const { appUser } = useAuth();
  const { data: tasks, loading: tasksLoading } = useTasks({ includeDeleted: true });
  const { data: projects, loading: projectsLoading } = useProjects(true);
  const { data: clients } = useClients(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deletedTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.isDeleted)
        .sort((a, b) => (b.deletedAt?.toMillis() ?? 0) - (a.deletedAt?.toMillis() ?? 0)),
    [tasks],
  );
  const deletedProjects = useMemo(
    () =>
      projects
        .filter((p) => p.isDeleted)
        .sort((a, b) => (b.deletedAt?.toMillis() ?? 0) - (a.deletedAt?.toMillis() ?? 0)),
    [projects],
  );
  const deletedClients = useMemo(
    () => clients.filter((c) => c.isDeleted),
    [clients],
  );

  const deletedProjectIds = useMemo(
    () => new Set(deletedProjects.map((p) => p.id)),
    [deletedProjects],
  );
  const projectNameById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );
  const clientNameById = useMemo(
    () => new Map(clients.map((c) => [c.id, c.name])),
    [clients],
  );

  const run = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "復元に失敗しました。権限をご確認ください。");
    } finally {
      setBusyId(null);
    }
  };

  const loading = tasksLoading || projectsLoading;
  const canRestoreProject = canManageProjects(appUser?.role);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Trash2 className="h-6 w-6" />
          ゴミ箱
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          削除から {TRASH_RETENTION_DAYS} 日経過すると、添付ファイルを含めて自動的に完全削除されます。
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          {/* --- プロジェクト --- */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              プロジェクト（{deletedProjects.length}）
            </h2>
            {deletedProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">削除されたプロジェクトはありません。</p>
            ) : (
              deletedProjects.map((p) => (
                <Card key={p.id}>
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {clientNameById.get(p.clientId) ?? "—"} ・ 削除日時:{" "}
                        {formatDateTime(p.deletedAt)}
                      </p>
                    </div>
                    {canRestoreProject ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === p.id}
                        onClick={() => run(p.id, () => setProjectDeleted(p.id, false))}
                      >
                        {busyId === p.id ? <Spinner /> : <RotateCcw />}
                        復元（配下タスクも復元）
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))
            )}
          </section>

          {/* --- タスク --- */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              タスク（{deletedTasks.length}）
            </h2>
            {deletedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">削除されたタスクはありません。</p>
            ) : (
              deletedTasks.map((t) => {
                const projectDeleted = deletedProjectIds.has(t.projectId);
                return (
                  <Card key={t.id}>
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/tasks/${t.id}`}
                            className="truncate font-medium hover:underline"
                          >
                            {t.title}
                          </Link>
                          {t.deletedByProject ? (
                            <Badge variant="secondary">プロジェクト削除に連動</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {clientNameById.get(t.clientId) ?? "—"} ／{" "}
                          {projectNameById.get(t.projectId) ?? "—"} ・ 削除日時:{" "}
                          {formatDateTime(t.deletedAt)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === t.id || projectDeleted}
                          onClick={() => run(t.id, () => setTaskDeleted(t.id, false))}
                        >
                          {busyId === t.id ? <Spinner /> : <RotateCcw />}
                          復元
                        </Button>
                        {projectDeleted ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            先にプロジェクトを復元してください
                          </p>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </section>

          {/* --- クライアント（admin のみ） --- */}
          {canManageClients(appUser?.role) ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                クライアント（{deletedClients.length}）
              </h2>
              {deletedClients.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  削除されたクライアントはありません。
                </p>
              ) : (
                deletedClients.map((c) => (
                  <Card key={c.id}>
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <p className="truncate font-medium">{c.name}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === c.id}
                        onClick={() => run(c.id, () => setClientDeleted(c.id, false))}
                      >
                        {busyId === c.id ? <Spinner /> : <RotateCcw />}
                        復元
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
              <p className="text-xs text-muted-foreground">
                ※ クライアントは完全削除の対象外です（参照整合性を保つため論理削除のまま保持されます）。
              </p>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
