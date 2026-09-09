"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { AssigneeFilter } from "@/components/tasks/AssigneeFilter";
import { ClientProjectTaskTree } from "@/components/tasks/ClientProjectTaskTree";
import { GroupedTaskList } from "@/components/tasks/GroupedTaskList";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClients, useProjects, useTasks, useUsers } from "@/hooks/useCollections";
import { isDashboardTab, type DashboardTab } from "@/lib/dashboard-tabs";
import {
  isAssignedTo,
  isDueSoon,
  isIncomplete,
  isOverdue,
} from "@/lib/tasks/filters";
import type { AppUser, Task } from "@/types";

/** 担当者フィルタ（OR 条件）。未選択なら全件。 */
function filterByAssignees(tasks: Task[], selected: string[]): Task[] {
  if (selected.length === 0) return tasks;
  return tasks.filter((t) => t.assignees.some((uid) => selected.includes(uid)));
}

/** タスク群に登場する担当者だけを候補として返す。 */
function assigneeCandidates(tasks: Task[], users: AppUser[]): AppUser[] {
  const uids = new Set(tasks.flatMap((t) => t.assignees));
  return users.filter((u) => uids.has(u.uid));
}

export default function DashboardPage() {
  // useSearchParams はプリレンダリング時に Suspense 境界が必要。
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      }
    >
      <DashboardView />
    </Suspense>
  );
}

function DashboardView() {
  const { appUser } = useAuth();
  const { data: tasks, loading: tasksLoading, error } = useTasks();
  const { data: projects } = useProjects();
  const { data: clients } = useClients(true);
  const { data: users } = useUsers();

  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: DashboardTab = isDashboardTab(tabParam) ? tabParam : "due-soon";

  // 担当者フィルタはタブを切り替えても保持する（期日間近・クライアント別で共有）。
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);

  const uid = appUser?.uid;

  const projectNameById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );
  const clientNameById = useMemo(
    () => new Map(clients.map((c) => [c.id, c.name])),
    [clients],
  );

  // ダッシュボードでは完了タスクを表示しない（完了はプロジェクト詳細でのみ表示）。
  const incomplete = useMemo(() => tasks.filter(isIncomplete), [tasks]);

  const { urgent, myTasks } = useMemo(() => {
    const now = new Date();
    return {
      // 期日間近タブの対象（超過 + 2日以内）。グループ分けは GroupedTaskList が行う。
      urgent: incomplete.filter((t) => isOverdue(t, now) || isDueSoon(t, now)),
      myTasks: uid ? incomplete.filter((t) => isAssignedTo(t, uid)) : [],
    };
  }, [incomplete, uid]);

  // 絞り込み候補は「そのタブで表示対象になっているタスクの担当者」に限定する。
  const urgentCandidates = useMemo(
    () => assigneeCandidates(urgent, users),
    [urgent, users],
  );
  const clientTabCandidates = useMemo(
    () => assigneeCandidates(incomplete, users),
    [incomplete, users],
  );

  const urgentFiltered = useMemo(
    () => filterByAssignees(urgent, assigneeFilter),
    [urgent, assigneeFilter],
  );
  const clientTabFiltered = useMemo(
    () => filterByAssignees(incomplete, assigneeFilter),
    [incomplete, assigneeFilter],
  );

  if (tasksLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">ダッシュボード</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ようこそ、{appUser?.displayName ?? appUser?.email} さん
          </p>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          読み込みに失敗しました: {error}
        </p>
      ) : null}

      <Tabs
        value={tab}
        onValueChange={(v) =>
          router.replace(`/dashboard?tab=${v}`, { scroll: false })
        }
      >
        <TabsList>
          <TabsTrigger value="due-soon">
            期日間近
            {urgent.length > 0 ? (
              <Badge variant="destructive">{urgent.length}</Badge>
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

        {/* --- 期日間近（超過 + 2日以内・未完了のみ） --- */}
        <TabsContent value="due-soon" className="space-y-4">
          <AssigneeFilter
            candidates={urgentCandidates}
            selected={assigneeFilter}
            onChange={setAssigneeFilter}
          />
          <GroupedTaskList
            tasks={urgentFiltered}
            users={users}
            projectNameById={projectNameById}
            clientNameById={clientNameById}
            emptyLabel={
              assigneeFilter.length > 0
                ? "絞り込み条件に一致するタスクはありません。"
                : "期日が迫っているタスクはありません。"
            }
          />
        </TabsContent>

        {/* --- マイタスク（期日間近と同じ3分類: 超過 → 2日以内 → それ以外） --- */}
        <TabsContent value="my-tasks">
          <GroupedTaskList
            tasks={myTasks}
            users={users}
            projectNameById={projectNameById}
            clientNameById={clientNameById}
            includeOthers
            emptyLabel="あなたが担当している未完了タスクはありません。"
          />
        </TabsContent>

        {/* --- クライアント ＞ プロジェクト ＞ タスク（未完了のみ） --- */}
        <TabsContent value="by-client" className="space-y-4">
          <AssigneeFilter
            candidates={clientTabCandidates}
            selected={assigneeFilter}
            onChange={setAssigneeFilter}
          />
          <ClientProjectTaskTree
            clients={clients}
            projects={projects}
            tasks={clientTabFiltered}
            users={users}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
