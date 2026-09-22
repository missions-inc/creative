"use client";

import { AlertTriangle } from "lucide-react";

import { TaskList } from "@/components/tasks/TaskList";
import {
  DUE_HEADING_CLASSES,
  DUE_SECTION_LABELS,
  DUE_URGENCIES,
  dueUrgency,
} from "@/lib/tasks/colors";
import { byDueThenPriority } from "@/lib/tasks/filters";
import { cn } from "@/lib/utils";
import type { AppUser, Task } from "@/types";

/**
 * 期日の緊急度でグループ化したタスク一覧（ダッシュボード共通）。
 *   1. 期日超過（最上部・赤見出し）
 *   2. 本日期日（黄見出し）
 *   3. 期日まで1〜2日（濃いめのグレー見出し）
 *   4. それ以外（includeOthers のときのみ・グレー見出し）
 * 分類は lib/tasks/colors.ts の dueUrgency（中身は lib/tasks/filters.ts の判定）を使い、
 * カードの枠線の色分けと必ず一致させる。
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
  const sections = DUE_URGENCIES.filter(
    (u) => u !== "normal" || includeOthers,
  ).map((urgency) => ({
    urgency,
    tasks: tasks
      .filter((t) => dueUrgency(t, now) === urgency)
      .sort(byDueThenPriority),
  }));

  const total = sections.reduce((sum, s) => sum + s.tasks.length, 0);
  if (total === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  const listProps = { users, projectNameById, clientNameById };

  return (
    <div className="space-y-6">
      {sections.map(({ urgency, tasks: sectionTasks }) =>
        sectionTasks.length > 0 ? (
          <section key={urgency} className="space-y-2">
            <h2
              className={cn(
                "flex items-center gap-2 text-sm font-semibold",
                DUE_HEADING_CLASSES[urgency],
              )}
            >
              {urgency === "overdue" ? (
                <AlertTriangle className="h-4 w-4" />
              ) : null}
              {DUE_SECTION_LABELS[urgency]}（{sectionTasks.length}）
            </h2>
            <TaskList tasks={sectionTasks} {...listProps} />
          </section>
        ) : null,
      )}
    </div>
  );
}
