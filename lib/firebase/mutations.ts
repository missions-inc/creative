"use client";

/**
 * 書き込み（作成・更新・論理削除）のデータ層。
 *
 * 読み出しは converters.ts の型付き参照を使い、書き込みはここで
 * 素の参照 + serverTimestamp() を使う（コンバータは id を要求するため）。
 * 各関数のフィールド構成は firestore.rules の検証条件と一致させること。
 */
import {
  addDoc,
  collection,
  deleteField,
  doc,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";

import { getDb } from "./client";
import type { TaskPriority, TaskStatus, Visibility } from "@/types";

// ---------------------------------------------------------------------------
// クライアント（admin のみ / §3.2）
// ---------------------------------------------------------------------------
export async function createClient(input: { name: string; note?: string }) {
  return addDoc(collection(getDb(), "clients"), {
    name: input.name.trim(),
    note: input.note?.trim() ?? "",
    isDeleted: false,
    createdAt: serverTimestamp(),
  });
}

export async function updateClient(
  id: string,
  input: { name: string; note?: string },
) {
  return updateDoc(doc(getDb(), "clients", id), {
    name: input.name.trim(),
    note: input.note?.trim() ?? "",
  });
}

/** 論理削除（ゴミ箱へ）。物理削除はルールで禁止。 */
export async function setClientDeleted(id: string, isDeleted: boolean) {
  return updateDoc(doc(getDb(), "clients", id), { isDeleted });
}

// ---------------------------------------------------------------------------
// プロジェクト（pm 以上 / §3.2）
// ---------------------------------------------------------------------------
export async function createProject(input: {
  clientId: string;
  name: string;
  visibility: Visibility;
}) {
  return addDoc(collection(getDb(), "projects"), {
    clientId: input.clientId,
    name: input.name.trim(),
    visibility: input.visibility,
    isDeleted: false,
    deletedAt: null,
    createdAt: serverTimestamp(),
  });
}

export async function updateProject(
  id: string,
  input: { name?: string; visibility?: Visibility },
) {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  return updateDoc(doc(getDb(), "projects", id), patch);
}

/**
 * プロジェクトの論理削除／復元。
 * 配下タスクの連動は Phase 7 の Cloud Functions で実装する。
 */
export async function setProjectDeleted(id: string, isDeleted: boolean) {
  return updateDoc(doc(getDb(), "projects", id), {
    isDeleted,
    deletedAt: isDeleted ? serverTimestamp() : null,
  });
}

// ---------------------------------------------------------------------------
// タスク
// ---------------------------------------------------------------------------
export interface TaskInput {
  projectId: string;
  clientId: string;
  title: string;
  description?: string;
  assignees: string[];
  dueAt: Timestamp | null;
  status: TaskStatus;
  priority: TaskPriority;
  visibility: Visibility;
}

export async function createTask(input: TaskInput, createdBy: string) {
  return addDoc(collection(getDb(), "tasks"), {
    projectId: input.projectId,
    clientId: input.clientId,
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    assignees: input.assignees,
    dueAt: input.dueAt,
    status: input.status,
    priority: input.priority,
    visibility: input.visibility,
    createdBy,
    isDeleted: false,
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTask(
  id: string,
  patch: Partial<Omit<TaskInput, "projectId" | "clientId">>,
) {
  const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.title !== undefined) data.title = patch.title.trim();
  if (patch.description !== undefined) data.description = patch.description.trim();
  if (patch.assignees !== undefined) data.assignees = patch.assignees;
  if (patch.dueAt !== undefined) data.dueAt = patch.dueAt;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.priority !== undefined) data.priority = patch.priority;
  if (patch.visibility !== undefined) data.visibility = patch.visibility;
  return updateDoc(doc(getDb(), "tasks", id), data);
}

/** ステータスのみ更新（一覧からのクイック変更用）。 */
export async function updateTaskStatus(id: string, status: TaskStatus) {
  return updateDoc(doc(getDb(), "tasks", id), {
    status,
    updatedAt: serverTimestamp(),
  });
}

/**
 * タスクの論理削除／復元。
 * 個別に復元した場合は、プロジェクト連動削除の印（deletedByProject）も外す
 * （残っているとプロジェクト復元時に二重で復元対象になるため）。
 */
export async function setTaskDeleted(id: string, isDeleted: boolean) {
  return updateDoc(doc(getDb(), "tasks", id), {
    isDeleted,
    deletedAt: isDeleted ? serverTimestamp() : null,
    ...(isDeleted ? {} : { deletedByProject: deleteField() }),
    updatedAt: serverTimestamp(),
  });
}
