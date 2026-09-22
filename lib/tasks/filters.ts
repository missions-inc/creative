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
import type { Task, TaskPriority } from "@/types";

/** 「2日前〜当日」の 2。リマインド通知（Phase 6）でも同じ値を使う。 */
export const DUE_SOON_WINDOW_DAYS = 2;

/**
 * リマインド通知を送る「期日までの残り日数」。当日(0) と 2日前(2)。
 *
 * ⚠️ ダッシュボードの「期日間近」（isDueSoon）は 0〜2 日の**範囲**を表示するのに対し、
 *    リマインド通知は 0 と 2 の**ちょうどその日**だけを対象とする（仕様書 §3.10）。
 *    Cloud Functions 側の定義は functions/src/shared/dueDates.ts にあり、
 *    両者がずれないよう tests/unit/dueDates.test.ts で突き合わせている。
 */
export const REMINDER_DAY_OFFSETS: readonly number[] = [0, DUE_SOON_WINDOW_DAYS];

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

/** 本日期日: 未完了かつ期日が当日（カレンダー日基準）。 */
export function isDueToday(task: Task, from = new Date()): boolean {
  if (!isIncomplete(task)) return false;
  return daysUntil(task.dueAt, from) === 0;
}

/** 期日超過: 未完了かつ期日が過去。 */
export function isOverdue(task: Task, from = new Date()): boolean {
  if (!isIncomplete(task)) return false;
  const d = daysUntil(task.dueAt, from);
  return d !== null && d < 0;
}

/**
 * リマインド通知の対象か（当日 または 2日前 ちょうど・未完了）。
 * 実際の送信は Cloud Functions が行う。ここでは UI 表示などの補助用。
 */
export function isReminderTarget(task: Task, from = new Date()): boolean {
  if (!isIncomplete(task)) return false;
  const d = daysUntil(task.dueAt, from);
  return d !== null && REMINDER_DAY_OFFSETS.includes(d);
}

/** 自分が担当者のタスク。 */
export function isAssignedTo(task: Task, uid: string): boolean {
  return task.assignees.includes(uid);
}

/** 優先度の並び順（小さいほど先）。 */
const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, mid: 1, low: 2 };

/** 期日のカレンダー日（0:00）をミリ秒で返す。期日なしは末尾に回るよう最大値。 */
function dueDayKey(task: Task): number {
  const ts = task.dueAt;
  if (!ts) return Number.MAX_SAFE_INTEGER;
  const d = ts.toDate();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * タスク一覧の統一並び順（全画面共通の唯一の定義）:
 *   第1キー: 期日の昇順（カレンダー日基準・近い順）。期日なしは末尾。
 *   第2キー: 優先度 高 → 中 → 低（同じ日なら時刻によらず優先度が優先）。
 *   第3キー: 期日の時刻順 → タイトル順（表示を安定させるため）。
 * ダッシュボードのセクション分け（超過 / 本日 / 1〜2日 / それ以外）の中でもこの順で並べる。
 */
export function byDueThenPriority(a: Task, b: Task): number {
  const ad = dueDayKey(a);
  const bd = dueDayKey(b);
  if (ad !== bd) return ad - bd;
  const ap = PRIORITY_ORDER[a.priority];
  const bp = PRIORITY_ORDER[b.priority];
  if (ap !== bp) return ap - bp;
  const at = a.dueAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
  const bt = b.dueAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
  if (at !== bt) return at - bt;
  return a.title.localeCompare(b.title);
}
