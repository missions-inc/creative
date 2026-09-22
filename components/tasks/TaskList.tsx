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
import { daysUntil, formatDateShort } from "@/lib/date";
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

/**
 * タスク一覧（アプリ全体で共通）。
 *
 * 1 画面により多くのタスクを表示するため、1 タスク = 1 行に圧縮している。
 *   [タスク名 + 優先度] [期日 / 担当 / 公開範囲] [ステータス変更]
 * 横幅が足りない場合はタスク名を truncate（末尾を「…」に）して情報量を保つ。
 * 文字色・太さは従来どおり（タスク名は font-medium + 既定色）。
 */
export function TaskList({
  tasks,
  users,
  emptyLabel = "タスクがありません。",
  showVisibility = true,
  /** 空表示の枠を小さくする（クライアント別ツリーのように行数が多い場所向け）。 */
  compactEmpty = false,
  /** 渡すとクライアント／プロジェクト名のパンくずを表示する（横断表示用）。 */
  projectNameById,
  clientNameById,
}: {
  tasks: Task[];
  users: AppUser[];
  emptyLabel?: string;
  showVisibility?: boolean;
  compactEmpty?: boolean;
  projectNameById?: Map<string, string>;
  clientNameById?: Map<string, string>;
}) {
  const nameByUid = new Map(users.map((u) => [u.uid, u.displayName ?? u.email]));
  const showBreadcrumb = Boolean(projectNameById || clientNameById);

  if (tasks.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed text-center",
          compactEmpty ? "py-2" : "py-12",
        )}
      >
        <p
          className={cn(
            "text-muted-foreground",
            compactEmpty ? "text-xs" : "text-sm",
          )}
        >
          {emptyLabel}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {tasks.map((task) => {
        const relative = dueRelativeLabel(task);
        const urgency = dueUrgency(task);
        const assigneeNames =
          task.assignees.length === 0
            ? "未割当"
            : task.assignees.map((uid) => nameByUid.get(uid) ?? uid).join("、");
        return (
          <Card
            key={task.id}
            className={cn(
              // 枠線 = 期日の緊急度（超過=赤 / 本日=黄 / 1〜2日=濃いグレー）。
              DUE_BORDER_CLASSES[urgency],
              task.isDeleted && "opacity-60",
            )}
          >
            <CardContent className="px-3 py-2">
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

              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                {/* タスク名（長い場合は末尾を「…」に短縮）+ 優先度。
                    期日以降は固定幅なので、横幅が足りないときは必ずここが縮む。 */}
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Link
                    href={`/tasks/${task.id}`}
                    title={task.title}
                    className="truncate font-medium hover:underline"
                  >
                    {task.title}
                  </Link>
                  <Badge
                    className={cn(
                      "shrink-0",
                      PRIORITY_BADGE_CLASSES[task.priority],
                    )}
                  >
                    {TASK_PRIORITY_LABELS[task.priority]}
                  </Badge>
                  {task.isDeleted ? (
                    <Badge variant="secondary" className="shrink-0">
                      削除済み
                    </Badge>
                  ) : null}
                </div>

                {/* 期日 / 担当 / 公開範囲（タスク名と同じ行に並べる）。
                    長い値は truncate し、全文は title 属性（ホバー）で確認できる。 */}
                <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      "whitespace-nowrap",
                      DUE_TEXT_CLASSES[urgency],
                    )}
                  >
                    期日: {formatDateShort(task.dueAt)}
                    {relative ? `（${relative}）` : ""}
                  </span>
                  <span
                    className="max-w-[10rem] truncate"
                    title={`担当: ${assigneeNames}`}
                  >
                    担当: {assigneeNames}
                  </span>
                  {showVisibility ? (
                    <span
                      className="max-w-[9rem] truncate"
                      title={describeVisibility(task.visibility)}
                    >
                      {describeVisibility(task.visibility)}
                    </span>
                  ) : null}
                </div>

                <div className="shrink-0 sm:w-32">
                  <Select
                    value={task.status}
                    onValueChange={(v) => updateTaskStatus(task.id, v as TaskStatus)}
                  >
                    {/* Select 自体をステータス色で塗る（変更は onSnapshot 経由で即反映） */}
                    <SelectTrigger
                      className={cn(
                        "h-8 text-xs",
                        STATUS_SELECT_TRIGGER_CLASSES[task.status],
                      )}
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
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
