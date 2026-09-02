"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { ClientProjectTaskTree } from "@/components/tasks/ClientProjectTaskTree";
import { TaskList } from "@/components/tasks/TaskList";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClients, useProjects, useTasks, useUsers } from "@/hooks/useCollections";
import {
  byDueThenTitle,
  isAssignedTo,
  isDueSoon,
  isIncomplete,
  isOverdue,
} from "@/lib/tasks/filters";

export default function DashboardPage() {
  const { appUser } = useAuth();
  const { data: tasks, loading: tasksLoading, error } = useTasks();
  const { data: projects } = useProjects();
  const { data: clients } = useClients(true);
  const { data: users } = useUsers();

  const uid = appUser?.uid;

  const projectNameById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );
  const clientNameById = useMemo(
    () => new Map(clients.map((c) => [c.id, c.name])),
    [clients],
  );

  // 期日超過と期日間近（2日前〜当日・未完了）を分けて算出する。
  const { overdue, dueSoon, myTasks } = useMemo(() => {
    const now = new Date();
    return {
      overdue: tasks.filter((t) => isOverdue(t, now)).sort(byDueThenTitle),
      dueSoon: tasks.filter((t) => isDueSoon(t, now)).sort(byDueThenTitle),
      myTasks: uid
        ? tasks
            .filter((t) => isAssignedTo(t, uid) && isIncomplete(t))
            .sort(byDueThenTitle)
        : [],
    };
  }, [tasks, uid]);

  const urgentCount = overdue.length + dueSoon.length;

  if (tasksLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ようこそ、{appUser?.displayName ?? appUser?.email} さん
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          読み込みに失敗しました: {error}
        </p>
      ) : null}

      <Tabs defaultValue="due-soon">
        <TabsList>
          <TabsTrigger value="due-soon">
            期日間近
            {urgentCount > 0 ? (
              <Badge variant="destructive">{urgentCount}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="my-tasks">
            マイタスク
            {myTasks.length > 0 ? (
              <Badge variant="secondary">{myTasks.length}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="by-client">クライアント別</TabsTrigger>
        </TabsList>

        {/* --- 期日間近（2日前〜当日・未完了） + 期日超過 --- */}
        <TabsContent value="due-soon" className="space-y-6">
          {overdue.length > 0 ? (
            <section className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4" />
                期日超過（{overdue.length}）
              </h2>
              <TaskList
                tasks={overdue}
                users={users}
                projectNameById={projectNameById}
                clientNameById={clientNameById}
              />
            </section>
          ) : null}

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              期日間近（本日〜2日以内・未完了）
            </h2>
            <TaskList
              tasks={dueSoon}
              users={users}
              projectNameById={projectNameById}
              clientNameById={clientNameById}
              emptyLabel="期日が迫っているタスクはありません。"
            />
          </section>
        </TabsContent>

        {/* --- マイタスク --- */}
        <TabsContent value="my-tasks">
          <TaskList
            tasks={myTasks}
            users={users}
            projectNameById={projectNameById}
            clientNameById={clientNameById}
            emptyLabel="あなたが担当している未完了タスクはありません。"
          />
        </TabsContent>

        {/* --- クライアント ＞ プロジェクト ＞ タスク --- */}
        <TabsContent value="by-client">
          <ClientProjectTaskTree
            clients={clients}
            projects={projects}
            tasks={tasks}
            users={users}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
