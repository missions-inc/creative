"use client";

/**
 * コメントの書き込み（仕様書 §3.7）。
 *
 * 権限（firestore.rules と一致）:
 *   - 作成: タスクにアクセスできる missions ユーザー。authorUid は本人固定。
 *   - 編集: 投稿者本人のみ（PM でも他人の本文は編集できない）。
 *   - 削除: 論理削除。本人 or PM 以上（他人の分は isDeleted のみ変更可）。
 */
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { getDb } from "./client";

export async function addComment(
  taskId: string,
  input: { body: string; parentId: string | null },
  authorUid: string,
) {
  return addDoc(collection(getDb(), "tasks", taskId, "comments"), {
    parentId: input.parentId,
    authorUid,
    body: input.body.trim(),
    isDeleted: false,
    createdAt: serverTimestamp(),
    editedAt: null,
  });
}

/** 本文の編集（本人のみ）。 */
export async function editComment(
  taskId: string,
  commentId: string,
  body: string,
) {
  return updateDoc(doc(getDb(), "tasks", taskId, "comments", commentId), {
    body: body.trim(),
    editedAt: serverTimestamp(),
  });
}

/**
 * 論理削除。
 * 他人のコメントを PM が削除する場合、ルールが body/authorUid の不変を要求するため
 * isDeleted 以外は変更しないこと。
 */
export async function deleteComment(taskId: string, commentId: string) {
  return updateDoc(doc(getDb(), "tasks", taskId, "comments", commentId), {
    isDeleted: true,
  });
}
