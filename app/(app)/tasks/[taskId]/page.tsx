"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, RotateCcw, Trash2 } from "lucide-react";

import { AttachmentPanel } from "@/components/attachments/AttachmentPanel";
import { CommentThread } from "@/components/comments/CommentThread";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LinkifiedText } from "@/components/ui/linkified-text";
import { Spinner } from "@/components/ui/loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClients, useProjects, useTasks, useUsers } from "@/hooks/useCollections";
import { formatDateTime } from "@/lib/date";
import { setTaskDeleted, updateTask, updateTaskStatus } from "@/lib/firebase/mutations";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  describeVisibility,
  type TaskStatus,
} from "@/types";

export default function TaskDetailPage() {
  const params = useParams<{ taskId: string }>();
  const taskId = params.taskId;

  const { data: tasks, loading } = useTasks({ includeDeleted: true });
  const { data: projects } = useProjects(true);
  const { data: clients } = useClients(true);
  const { data: users } = useUsers();
  const [editing, setEditing] = useState(false);

  const task = tasks.find((t) => t.id === taskId);
  const project = projects.find((p) => p.id === task?.projectId);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="font-medium">タスクが見つかりません</p>
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

  const clientName = clients.find((c) => c.id === task.clientId)?.name;
  const nameByUid = new Map(users.map((u) => [u.uid, u.displayName ?? u.email]));

  return (
    <div className="space-y-6">
      <div>
        {project ? (
          <Link
            href={`/projects/${project.id}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {project.name}
          </Link>
        ) : null}

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {clientName ?? "—"}
              {project ? ` ／ ${project.name}` : ""}
            </p>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              {task.title}
              {task.isDeleted ? <Badge variant="secondary">削除済み</Badge> : null}
            </h1>
          </div>

          <div className="flex gap-2">
            {project ? (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil />
                編集
              </Button>
            ) : null}
            <Button
              variant={task.isDeleted ? "outline" : "destructive"}
              onClick={() => setTaskDeleted(task.id, !task.isDeleted)}
            >
              {task.isDeleted ? <RotateCcw /> : <Trash2 />}
              {task.isDeleted ? "復元" : "削除"}
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">ステータス</p>
            <Select
              value={task.status}
              onValueChange={(v) => updateTaskStatus(task.id, v as TaskStatus)}
            >
              <SelectTrigger className="sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {TASK_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Field label="優先度">
            <Badge variant={task.priority}>
              {TASK_PRIORITY_LABELS[task.priority]}
            </Badge>
          </Field>

          <Field label="期日">{formatDateTime(task.dueAt)}</Field>

          <Field label="公開範囲">
            <Badge variant="outline">{describeVisibility(task.visibility)}</Badge>
          </Field>

          <Field label="担当者">
            {task.assignees.length === 0
              ? "未割当"
              : task.assignees.map((uid) => nameByUid.get(uid) ?? uid).join("、")}
          </Field>

          <Field label="作成者">
            {nameByUid.get(task.createdBy) ?? task.createdBy}
          </Field>
        </CardContent>
      </Card>

      {task.description ? (
        <Card>
          <CardContent className="p-4">
            <p className="mb-2 text-xs text-muted-foreground">詳細</p>
            <p className="text-sm">
              <LinkifiedText text={task.description ?? ""} />
            </p>
          </CardContent>
        </Card>
      ) : null}

      <AttachmentPanel taskId={task.id} users={users} />

      <CommentThread taskId={task.id} users={users} />

      {project ? (
        <TaskDialog
          open={editing}
          onOpenChange={setEditing}
          title="タスクを編集"
          project={project}
          users={users}
          initial={task}
          onSubmit={async (v) => {
            await updateTask(task.id, v);
          }}
        />
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}
