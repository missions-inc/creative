/**
 * =============================================================================
 * タスクの絞り込みロジック（ダッシュボード §3.9 / リマインド §3.10 共通）
 * -----------------------------------------------------------------------------
 * 「期日間近」の定義はダッシュボード表示と Phase 6 の毎朝のリマインド通知で
 * 同じものを使う。判定を二重管理しないよう、ここを唯一の定義とする。
 *
 * 仕様:
 *   期日間近 = 期日が「2日前（カレンダー日基準）」〜「当日」の未完了タスク
 *            → daysUntil(dueAt) が 0, 1, 2 のいずれか
 *   期日超過 = 期日を過ぎた未完了タスク（daysUntil < 0）
 * =============================================================================
 */
import { daysUntil } from "@/lib/date";
import type { Task } from "@/types";

/** 「2日前〜当日」の 2。リマインド通知（Phase 6）でも同じ値を使う。 */
export const DUE_SOON_WINDOW_DAYS = 2;

/** 未完了（完了しておらず、削除もされていない）。 */
export function isIncomplete(task: Task): boolean {
  return !task.isDeleted && task.status !== "done";
}

/** 期日間近: 未完了かつ期日が 0〜2 日後（カレンダー日基準）。 */
export function isDueSoon(task: Task, from = new Date()): boolean {
  if (!isIncomplete(task)) return false;
  const d = daysUntil(task.dueAt, from);
  return d !== null && d >= 0 && d <= DUE_SOON_WINDOW_DAYS;
}

/** 期日超過: 未完了かつ期日が過去。 */
export function isOverdue(task: Task, from = new Date()): boolean {
  if (!isIncomplete(task)) return false;
  const d = daysUntil(task.dueAt, from);
  return d !== null && d < 0;
}

/** 自分が担当者のタスク。 */
export function isAssignedTo(task: Task, uid: string): boolean {
  return task.assignees.includes(uid);
}

/** 期日昇順（期日なしは末尾）→ 同着はタイトル順。 */
export function byDueThenTitle(a: Task, b: Task): number {
  const av = a.dueAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
  const bv = b.dueAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
  if (av !== bv) return av - bv;
  return a.title.localeCompare(b.title);
}
