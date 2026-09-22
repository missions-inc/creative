/**
 * =============================================================================
 * タスクの色分けルール（アプリ全体で共有する唯一の定義）
 * -----------------------------------------------------------------------------
 * 役割の住み分け:
 *   - 枠線（カード）= 期日の緊急度
 *     （超過=赤 / 本日=黄 / 1〜2日=濃いめのグレー / それ以外=通常のグレー）
 *   - ステータスの Select = ステータス（未着手=赤 / 進行中=黄 / 確認待ち=緑 / 完了=グレー）
 *   - バッジ = 優先度（高=赤 / 中=アンバー / 低=グレー）
 * ステータス色はカードの枠線に使わないこと。緊急度の色は Select・バッジに使わないこと。
 *
 * 緊急度の判定は lib/tasks/filters.ts（毎朝のリマインド通知と同じ定義）に
 * 委譲しており、ここで新しい期日ロジックは作らない。
 * 色だけに意味を持たせず、必ずテキストラベルを併記すること（色覚特性への配慮）。
 * =============================================================================
 */
import { isDueSoon, isDueToday, isOverdue } from "@/lib/tasks/filters";
import type { Task, TaskPriority, TaskStatus } from "@/types";

// ---------------------------------------------------------------------------
// 期日の緊急度（枠線・セクション見出し）
// ---------------------------------------------------------------------------
/**
 * 期日の 4 分類。
 *   overdue   : 期日超過
 *   due_today : 本日が期日
 *   due_near  : 期日まで 1〜2 日
 *   normal    : それ以外（3日以上先・期日なし・完了）
 */
export type DueUrgency = "overdue" | "due_today" | "due_near" | "normal";

/** 表示順（上から）。セクションの並びもこの順に従う。 */
export const DUE_URGENCIES: DueUrgency[] = [
  "overdue",
  "due_today",
  "due_near",
  "normal",
];

/**
 * タスクの緊急度。完了・削除済み・期日なしは normal。
 * 判定は lib/tasks/filters.ts（毎朝のリマインド通知と同じ定義）に委譲する。
 * due_near は「isDueSoon（0〜2日）かつ本日ではない」= 1〜2日 として導出する。
 */
export function dueUrgency(task: Task, from = new Date()): DueUrgency {
  if (isOverdue(task, from)) return "overdue";
  if (isDueToday(task, from)) return "due_today";
  if (isDueSoon(task, from)) return "due_near";
  return "normal";
}

/** カードの枠線クラス（太さ 1px = 通常の枠線と同じ）。normal は既定の枠線（グレー）のまま。 */
export const DUE_BORDER_CLASSES: Record<DueUrgency, string> = {
  overdue: "border border-red-500",
  due_today: "border border-yellow-400",
  due_near: "border border-slate-400",
  normal: "",
};

/** 期日テキストの強調クラス（枠線と同じ意味・同系色）。 */
export const DUE_TEXT_CLASSES: Record<DueUrgency, string> = {
  overdue: "text-red-600 font-medium",
  due_today: "text-yellow-700 font-medium",
  due_near: "text-slate-600 font-medium",
  normal: "",
};

/** セクション見出し用（ダッシュボードの「期日超過」「本日期日」など）。 */
export const DUE_HEADING_CLASSES: Record<DueUrgency, string> = {
  overdue: "text-red-600",
  due_today: "text-yellow-700",
  due_near: "text-slate-600",
  normal: "text-muted-foreground",
};

/** セクション見出しのラベル（ダッシュボード共通）。 */
export const DUE_SECTION_LABELS: Record<DueUrgency, string> = {
  overdue: "期日超過",
  due_today: "本日期日",
  due_near: "期日まで1〜2日",
  normal: "それ以外",
};

// ---------------------------------------------------------------------------
// ステータス（ステータス変更 Select の配色に使用）
// ---------------------------------------------------------------------------

/** Select のトリガー（閉じた状態）用。背景 + 文字色でステータスを表す。 */
export const STATUS_SELECT_TRIGGER_CLASSES: Record<TaskStatus, string> = {
  not_started: "border-transparent bg-red-100 text-red-800",
  in_progress: "border-transparent bg-yellow-100 text-yellow-800",
  in_review: "border-transparent bg-green-100 text-green-800",
  done: "border-transparent bg-slate-200 text-slate-600",
};

/**
 * Select のドロップダウン項目用。
 * ハイライト（focus）時も同系色を維持し、色の区別が消えないようにする。
 */
export const STATUS_SELECT_ITEM_CLASSES: Record<TaskStatus, string> = {
  not_started: "text-red-700 focus:bg-red-100 focus:text-red-800",
  in_progress: "text-yellow-700 focus:bg-yellow-100 focus:text-yellow-800",
  in_review: "text-green-700 focus:bg-green-100 focus:text-green-800",
  done: "text-slate-500 focus:bg-slate-200 focus:text-slate-700",
};

// ---------------------------------------------------------------------------
// 優先度（バッジに使用）
// ---------------------------------------------------------------------------
export const PRIORITY_BADGE_CLASSES: Record<TaskPriority, string> = {
  high: "border-transparent bg-red-100 text-red-800",
  mid: "border-transparent bg-amber-100 text-amber-800",
  low: "border-transparent bg-slate-100 text-slate-700",
};
