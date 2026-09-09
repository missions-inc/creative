"use client";

import { AlertTriangle } from "lucide-react";

import { TaskList } from "@/components/tasks/TaskList";
import { DUE_HEADING_CLASSES } from "@/lib/tasks/colors";
import { byDueThenTitle, isDueSoon, isOverdue } from "@/lib/tasks/filters";
import { cn } from "@/lib/utils";
import type { AppUser, Task } from "@/types";

/**
 * 期日の緊急度でグループ化したタスク一覧（ダッシュボード共通）。
 *   1. 期日超過（最上部・赤見出し）
 *   2. 期日が2日以内（黄見出し）
 *   3. それ以外（includeOthers のときのみ）
 * 分類は lib/tasks/filters.ts（リマインド通知と同一定義）を使う。
 * 渡すタスクは呼び出し側で未完了に絞っておくこと（完了はダッシュボードに出さない）。
 */
export function GroupedTaskList({
  tasks,
  users,
  projectNameById,
  clientNameById,
  includeOthers = false,
  emptyLabel = "タスクがありません。",
}: {
  tasks: Task[];
  users: AppUser[];
  projectNameById?: Map<string, string>;
  clientNameById?: Map<string, string>;
  includeOthers?: boolean;
  emptyLabel?: string;
}) {
  const now = new Date();
  const overdue = tasks.filter((t) => isOverdue(t, now)).sort(byDueThenTitle);
  const dueSoon = tasks.filter((t) => isDueSoon(t, now)).sort(byDueThenTitle);
  const others = includeOthers
    ? tasks
        .filter((t) => !isOverdue(t, now) && !isDueSoon(t, now))
        .sort(byDueThenTitle)
    : [];

  if (overdue.length + dueSoon.length + others.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  const listProps = { users, projectNameById, clientNameById };

  return (
    <div className="space-y-6">
      {overdue.length > 0 ? (
        <section className="space-y-2">
          <h2
            className={cn(
              "flex items-center gap-2 text-sm font-semibold",
              DUE_HEADING_CLASSES.overdue,
            )}
          >
            <AlertTriangle className="h-4 w-4" />
            期日超過（{overdue.length}）
          </h2>
          <TaskList tasks={overdue} {...listProps} />
        </section>
      ) : null}

      {dueSoon.length > 0 ? (
        <section className="space-y-2">
          <h2
            className={cn(
              "text-sm font-semibold",
              DUE_HEADING_CLASSES.due_soon,
            )}
          >
            期日まで2日以内（{dueSoon.length}）
          </h2>
          <TaskList tasks={dueSoon} {...listProps} />
        </section>
      ) : null}

      {others.length > 0 ? (
        <section className="space-y-2">
          <h2
            className={cn("text-sm font-semibold", DUE_HEADING_CLASSES.normal)}
          >
            それ以外（{others.length}）
          </h2>
          <TaskList tasks={others} {...listProps} />
        </section>
      ) : null}
    </div>
  );
}
