"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { TaskList } from "@/components/tasks/TaskList";
import { Badge } from "@/components/ui/badge";
import { byDueThenTitle } from "@/lib/tasks/filters";
import { describeVisibility, type AppUser, type Client, type Project, type Task } from "@/types";

/**
 * クライアント ＞ プロジェクト ＞ タスクの階層表示（§3.9）。
 *
 * アクセス制御を反映し、見えないものは表示しない。
 * なお「担当者は常にアクセス可」（境界ルール1）により、
 * *プロジェクトは見えないがタスクだけ見える* ケースが起こりうる。
 * その場合はクライアント直下に「プロジェクト外」としてまとめる。
 */
export function ClientProjectTaskTree({
  clients,
  projects,
  tasks,
  users,
}: {
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  users: AppUser[];
}) {
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const accessibleProjectIds = new Set(projects.map((p) => p.id));

  const tasksByProject = new Map<string, Task[]>();
  const orphanTasksByClient = new Map<string, Task[]>();
  for (const t of tasks) {
    if (accessibleProjectIds.has(t.projectId)) {
      const list = tasksByProject.get(t.projectId) ?? [];
      list.push(t);
      tasksByProject.set(t.projectId, list);
    } else {
      const list = orphanTasksByClient.get(t.clientId) ?? [];
      list.push(t);
      orphanTasksByClient.set(t.clientId, list);
    }
  }

  const projectsByClient = new Map<string, Project[]>();
  for (const p of projects) {
    const list = projectsByClient.get(p.clientId) ?? [];
    list.push(p);
    projectsByClient.set(p.clientId, list);
  }

  // 表示対象クライアント = アクセスできるプロジェクト or タスクを持つもののみ。
  const clientIds = Array.from(
    new Set([...projectsByClient.keys(), ...orphanTasksByClient.keys()]),
  ).sort((a, b) =>
    (clientById.get(a)?.name ?? "").localeCompare(clientById.get(b)?.name ?? ""),
  );

  if (clientIds.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm text-muted-foreground">
          表示できるクライアント・プロジェクトがありません。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {clientIds.map((clientId) => {
        const client = clientById.get(clientId);
        const clientProjects = (projectsByClient.get(clientId) ?? []).sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        const orphans = (orphanTasksByClient.get(clientId) ?? []).sort(byDueThenTitle);
        const total =
          orphans.length +
          clientProjects.reduce(
            (sum, p) => sum + (tasksByProject.get(p.id)?.length ?? 0),
            0,
          );

        return (
          <section key={clientId} className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <h2 className="text-lg font-semibold">
                {client?.name ?? "（不明なクライアント）"}
              </h2>
              <Badge variant="secondary">{total}件</Badge>
              {client?.isDeleted ? (
                <Badge variant="outline">削除済み</Badge>
              ) : null}
            </div>

            {clientProjects.map((project) => {
              const projectTasks = (tasksByProject.get(project.id) ?? []).sort(
                byDueThenTitle,
              );
              return (
                <div key={project.id} className="space-y-2 pl-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-medium hover:underline"
                    >
                      {project.name}
                    </Link>
                    <Badge variant="outline">
                      {describeVisibility(project.visibility)}
                    </Badge>
                    {project.isDeleted ? (
                      <Badge variant="secondary">削除済み</Badge>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {projectTasks.length}件
                    </span>
                  </div>
                  <div className="pl-6">
                    <TaskList
                      tasks={projectTasks}
                      users={users}
                      emptyLabel="タスクはありません。"
                    />
                  </div>
                </div>
              );
            })}

            {orphans.length > 0 ? (
              <div className="space-y-2 pl-1">
                <div className="flex flex-wrap items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-muted-foreground">
                    プロジェクト外
                  </span>
                  <span className="text-xs text-muted-foreground">
                    担当者として参照できるタスク（プロジェクト自体は非公開）
                  </span>
                </div>
                <div className="pl-6">
                  <TaskList tasks={orphans} users={users} />
                </div>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
