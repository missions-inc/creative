/**
 * =============================================================================
 * タスクの色分けルール（アプリ全体で共有する唯一の定義）
 * -----------------------------------------------------------------------------
 * 役割の住み分け:
 *   - 枠線   = 期日の緊急度（超過=赤 / 2日以内=黄 / それ以外=通常）
 *   - バッジ = ステータス（未着手=赤 / 進行中=黄 / 確認待ち=緑 / 完了=グレー）
 * ステータス色は枠線に使わないこと。緊急度の色はバッジに使わないこと。
 *
 * 緊急度の判定は lib/tasks/filters.ts（毎朝のリマインド通知と同じ定義）に
 * 委譲しており、ここで新しい期日ロジックは作らない。
 * 色だけに意味を持たせず、必ずテキストラベルを併記すること（色覚特性への配慮）。
 * =============================================================================
 */
import { isDueSoon, isOverdue } from "@/lib/tasks/filters";
import type { Task, TaskStatus } from "@/types";

// ---------------------------------------------------------------------------
// 期日の緊急度（枠線）
// ---------------------------------------------------------------------------
export type DueUrgency = "overdue" | "due_soon" | "normal";

/** タスクの緊急度。完了・削除済み・期日なしは normal（filters.ts の定義に従う）。 */
export function dueUrgency(task: Task, from = new Date()): DueUrgency {
  if (isOverdue(task, from)) return "overdue";
  if (isDueSoon(task, from)) return "due_soon";
  return "normal";
}

/** カードの枠線クラス。normal は既定の枠線のまま。 */
export const DUE_BORDER_CLASSES: Record<DueUrgency, string> = {
  overdue: "border-2 border-red-500",
  due_soon: "border-2 border-yellow-400",
  normal: "",
};

/** 期日テキストの強調クラス（枠線と同じ意味・同系色）。 */
export const DUE_TEXT_CLASSES: Record<DueUrgency, string> = {
  overdue: "text-red-600 font-medium",
  due_soon: "text-yellow-700 font-medium",
  normal: "",
};

/** セクション見出し用（ダッシュボードの「期日超過」「2日以内」）。 */
export const DUE_HEADING_CLASSES: Record<DueUrgency, string> = {
  overdue: "text-red-600",
  due_soon: "text-yellow-700",
  normal: "text-muted-foreground",
};

// ---------------------------------------------------------------------------
// ステータス（バッジ / ラベルのみに使用）
// ---------------------------------------------------------------------------
export const STATUS_BADGE_CLASSES: Record<TaskStatus, string> = {
  not_started: "border-transparent bg-red-100 text-red-800",
  in_progress: "border-transparent bg-yellow-100 text-yellow-800",
  in_review: "border-transparent bg-green-100 text-green-800",
  done: "border-transparent bg-slate-200 text-slate-600",
};
