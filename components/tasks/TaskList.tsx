"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { daysUntil, formatDateTime } from "@/lib/date";
import {
  DUE_BORDER_CLASSES,
  DUE_TEXT_CLASSES,
  PRIORITY_BADGE_CLASSES,
  STATUS_SELECT_ITEM_CLASSES,
  STATUS_SELECT_TRIGGER_CLASSES,
  dueUrgency,
} from "@/lib/tasks/colors";
import { updateTaskStatus } from "@/lib/firebase/mutations";
import { cn } from "@/lib/utils";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  describeVisibility,
  type AppUser,
  type Task,
  type TaskStatus,
} from "@/types";

/** 期日までの残り日数を人間向けに表す。 */
function dueRelativeLabel(task: Task): string | null {
  if (task.status === "done") return null;
  const d = daysUntil(task.dueAt);
  if (d === null) return null;
  if (d < 0) return `${Math.abs(d)}日超過`;
  if (d === 0) return "本日";
  return `あと${d}日`;
}

export function TaskList({
  tasks,
  users,
  emptyLabel = "タスクがありません。",
  showVisibility = true,
  /** 渡すとクライアント／プロジェクト名のパンくずを表示する（横断表示用）。 */
  projectNameById,
  clientNameById,
}: {
  tasks: Task[];
  users: AppUser[];
  emptyLabel?: string;
  showVisibility?: boolean;
  projectNameById?: Map<string, string>;
  clientNameById?: Map<string, string>;
}) {
  const nameByUid = new Map(users.map((u) => [u.uid, u.displayName ?? u.email]));
  const showBreadcrumb = Boolean(projectNameById || clientNameById);

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const relative = dueRelativeLabel(task);
        const urgency = dueUrgency(task);
        return (
          <Card
            key={task.id}
            className={cn(
              // 枠線 = 期日の緊急度（超過=赤 / 2日以内=黄）。ステータス色は使わない。
              DUE_BORDER_CLASSES[urgency],
              task.isDeleted && "opacity-60",
            )}
          >
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                {showBreadcrumb ? (
                  <p className="mb-0.5 truncate text-xs text-muted-foreground">
                    {clientNameById?.get(task.clientId) ?? "—"}
                    {" ／ "}
                    <Link
                      href={`/projects/${task.projectId}`}
                      className="hover:underline"
                    >
                      {projectNameById?.get(task.projectId) ?? "—"}
                    </Link>
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/tasks/${task.id}`}
                    className="truncate font-medium hover:underline"
                  >
                    {task.title}
                  </Link>
                  {/* バッジ = 優先度（ステータスの色は右の Select が担う） */}
                  <Badge className={PRIORITY_BADGE_CLASSES[task.priority]}>
                    {TASK_PRIORITY_LABELS[task.priority]}
                  </Badge>
                  {task.isDeleted ? (
                    <Badge variant="secondary">削除済み</Badge>
                  ) : null}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className={cn(DUE_TEXT_CLASSES[urgency])}>
                    期日: {formatDateTime(task.dueAt)}
                    {relative ? `（${relative}）` : ""}
                  </span>
                  <span>
                    担当:{" "}
                    {task.assignees.length === 0
                      ? "未割当"
                      : task.assignees
                          .map((uid) => nameByUid.get(uid) ?? uid)
                          .join("、")}
                  </span>
                  {showVisibility ? (
                    <span>{describeVisibility(task.visibility)}</span>
                  ) : null}
                </div>
              </div>

              <div className="shrink-0 sm:w-40">
                <Select
                  value={task.status}
                  onValueChange={(v) => updateTaskStatus(task.id, v as TaskStatus)}
                >
                  {/* Select 自体をステータス色で塗る（変更は onSnapshot 経由で即反映） */}
                  <SelectTrigger
                    className={STATUS_SELECT_TRIGGER_CLASSES[task.status]}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => (
                      <SelectItem
                        key={s}
                        value={s}
                        className={STATUS_SELECT_ITEM_CLASSES[s]}
                      >
                        {TASK_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
