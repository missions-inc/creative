"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { ProjectDialog } from "@/components/projects/ProjectDialog";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { TaskList } from "@/components/tasks/TaskList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/loader";
import {
  useClients,
  useProjects,
  useTasks,
  useUsers,
} from "@/hooks/useCollections";
import { canManageProjects } from "@/lib/auth/roles";
import {
  createTask,
  setProjectDeleted,
  updateProject,
} from "@/lib/firebase/mutations";
import { describeVisibility } from "@/types";

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const { appUser } = useAuth();
  const { data: projects, loading } = useProjects(true);
  const { data: clients } = useClients(true);
  const { data: users } = useUsers();
  const { data: tasks, loading: tasksLoading } = useTasks({ projectId });

  const [editing, setEditing] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);

  const project = projects.find((p) => p.id === projectId);
  const canManage = canManageProjects(appUser?.role);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="font-medium">プロジェクトが見つかりません</p>
        <p className="text-sm text-muted-foreground">
          削除されたか、閲覧権限がない可能性があります。
        </p>
        <Button variant="outline" asChild>
          <Link href="/projects">
            <ArrowLeft />
            プロジェクト一覧へ
          </Link>
        </Button>
      </div>
    );
  }

  const clientName = clients.find((c) => c.id === project.clientId)?.name;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          プロジェクト一覧
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {clientName ?? "（不明なクライアント）"}
            </p>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              {project.name}
              {project.isDeleted ? (
                <Badge variant="secondary">削除済み</Badge>
              ) : null}
            </h1>
            <Badge variant="outline" className="mt-2">
              {describeVisibility(project.visibility)}
            </Badge>
          </div>

          <div className="flex gap-2">
            {canManage ? (
              <>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil />
                  編集
                </Button>
                <Button
                  variant={project.isDeleted ? "outline" : "destructive"}
                  onClick={() => setProjectDeleted(project.id, !project.isDeleted)}
                >
                  {project.isDeleted ? <RotateCcw /> : <Trash2 />}
                  {project.isDeleted ? "復元" : "削除"}
                </Button>
              </>
            ) : null}
            <Button onClick={() => setCreatingTask(true)}>
              <Plus />
              タスク追加
            </Button>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          タスク（{tasks.length}）
        </h2>
        {tasksLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <TaskList
            tasks={tasks}
            users={users}
            emptyLabel="このプロジェクトにはまだタスクがありません。"
          />
        )}
      </section>

      <ProjectDialog
        open={editing}
        onOpenChange={setEditing}
        title="プロジェクトを編集"
        clients={clients}
        users={users}
        initial={project}
        lockClient
        onSubmit={async (v) => {
          await updateProject(project.id, {
            name: v.name,
            visibility: v.visibility,
          });
        }}
      />

      <TaskDialog
        open={creatingTask}
        onOpenChange={setCreatingTask}
        title="タスクを追加"
        project={project}
        users={users}
        onSubmit={async (v) => {
          if (!appUser) return;
          await createTask(
            {
              projectId: project.id,
              clientId: project.clientId,
              ...v,
            },
            appUser.uid,
          );
        }}
      />
    </div>
  );
}
