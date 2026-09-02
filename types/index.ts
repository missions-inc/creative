/**
 * Firestore ドキュメントの型定義（アプリ全体で共有）。
 * データモデルは仕様書 §3.4 に準拠。
 *
 * 注意:
 * - タイムスタンプはクライアント SDK の `Timestamp` を用いる。
 * - 書き込み時は `serverTimestamp()` を使うため、書き込み用の型では
 *   一部フィールドを `FieldValue` 許容にすることがある（変換層で吸収）。
 */
import type { Timestamp } from "firebase/firestore";

// ---------------------------------------------------------------------------
// ロール
// ---------------------------------------------------------------------------
export type Role = "admin" | "pm" | "member";

export const ROLES: Role[] = ["admin", "pm", "member"];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "管理者",
  pm: "PM",
  member: "メンバー",
};

// ---------------------------------------------------------------------------
// 公開範囲（visibility）— 仕様書 §3.3 / §3.4
// ---------------------------------------------------------------------------
export type VisibilityMode = "all" | "role_limited" | "member_limited";

export type Visibility =
  | { mode: "all" }
  | { mode: "role_limited"; roles: Role[] }
  | { mode: "member_limited"; memberUids: string[] };

export const VISIBILITY_MODE_LABELS: Record<VisibilityMode, string> = {
  all: "全メンバー",
  role_limited: "ロール限定",
  member_limited: "メンバー限定",
};

/** visibility を人が読める短い文字列にする（一覧のバッジ表示など）。 */
export function describeVisibility(v: Visibility): string {
  switch (v.mode) {
    case "all":
      return "全メンバー";
    case "role_limited":
      return `ロール限定: ${v.roles.map((r) => ROLE_LABELS[r]).join("・") || "なし"}`;
    case "member_limited":
      return `メンバー限定: ${v.memberUids.length}名`;
  }
}

// ---------------------------------------------------------------------------
// タスクのステータス・優先度 — 仕様書 §3.5（固定値）
// ---------------------------------------------------------------------------
export type TaskStatus = "not_started" | "in_progress" | "in_review" | "done";

export const TASK_STATUSES: TaskStatus[] = [
  "not_started",
  "in_progress",
  "in_review",
  "done",
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "未着手",
  in_progress: "進行中",
  in_review: "確認待ち",
  done: "完了",
};

export type TaskPriority = "high" | "mid" | "low";

export const TASK_PRIORITIES: TaskPriority[] = ["high", "mid", "low"];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "高",
  mid: "中",
  low: "低",
};

// ---------------------------------------------------------------------------
// ドキュメント型
// ---------------------------------------------------------------------------

/** users/{uid} */
export interface AppUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL?: string | null;
  role: Role;
  createdAt: Timestamp;
}

/** clients/{clientId} */
export interface Client {
  id: string;
  name: string;
  note?: string;
  isDeleted: boolean;
  createdAt: Timestamp;
}

/** projects/{projectId} */
export interface Project {
  id: string;
  clientId: string;
  name: string;
  visibility: Visibility;
  isDeleted: boolean;
  deletedAt?: Timestamp | null;
  createdAt: Timestamp;
}

/** tasks/{taskId} */
export interface Task {
  id: string;
  projectId: string;
  clientId: string;
  title: string;
  description?: string;
  assignees: string[];
  dueAt?: Timestamp | null;
  status: TaskStatus;
  priority: TaskPriority;
  visibility: Visibility;
  createdBy: string;
  isDeleted: boolean;
  deletedAt?: Timestamp | null;
  /** プロジェクト削除に連動してゴミ箱入りした印（Cloud Functions が付与・復元時に除去）。 */
  deletedByProject?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** tasks/{taskId}/comments/{commentId} */
export interface Comment {
  id: string;
  parentId: string | null;
  authorUid: string;
  body: string;
  isDeleted: boolean;
  createdAt: Timestamp;
  editedAt?: Timestamp | null;
}

/** tasks/{taskId}/attachments/{attachmentId} */
export interface Attachment {
  id: string;
  fileName: string;
  storagePath: string;
  contentType: string;
  size: number;
  uploadedBy: string;
  createdAt: Timestamp;
}

/** notifications/{notificationId} */
export type NotificationType = "assigned" | "completed" | "reminder";

export interface AppNotification {
  id: string;
  toUid: string;
  type: NotificationType;
  taskId: string;
  isRead: boolean;
  createdAt: Timestamp;
}
