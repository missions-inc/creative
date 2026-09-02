"use client";

/**
 * 添付ファイルの書き込み（仕様書 §3.6）。
 *
 * 実体は Firebase Storage、メタ情報は tasks/{taskId}/attachments に保存する。
 * サイズ・形式はクライアント側（lib/attachments/constraints.ts）に加えて
 * Firestore ルール・Storage ルールでも検証される。
 */
import { collection, deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { attachmentStoragePath, sanitizeFileName } from "@/lib/attachments/constraints";
import type { Attachment } from "@/types";
import { getDb, getFirebaseStorage } from "./client";

/**
 * ファイルをアップロードし、メタ情報ドキュメントを作成する。
 *
 * ドキュメント ID を先に採番して Storage のパスに含めるため、
 * 同名ファイルでも衝突しない。
 * メタ情報の作成に失敗した場合は、孤児ファイルが残らないよう実体を削除する。
 */
export async function uploadAttachment(
  taskId: string,
  file: File,
  uploadedBy: string,
): Promise<string> {
  const metaRef = doc(collection(getDb(), "tasks", taskId, "attachments"));
  const fileName = sanitizeFileName(file.name);
  const storagePath = attachmentStoragePath(taskId, metaRef.id, fileName);
  const storageRef = ref(getFirebaseStorage(), storagePath);

  await uploadBytes(storageRef, file, { contentType: file.type });

  try {
    await setDoc(metaRef, {
      fileName,
      storagePath,
      contentType: file.type,
      size: file.size,
      uploadedBy,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    // メタ情報が作れなければ実体も残さない。
    await deleteObject(storageRef).catch(() => undefined);
    throw e;
  }

  return metaRef.id;
}

/** ダウンロード URL を取得する（Storage ルールで閲覧権限が検証される）。 */
export async function getAttachmentDownloadUrl(
  storagePath: string,
): Promise<string> {
  return getDownloadURL(ref(getFirebaseStorage(), storagePath));
}

/**
 * 添付を削除する。
 * Storage ルールがメタ情報ドキュメント（uploadedBy）を参照して権限を判定するため、
 * **実体 → メタ情報**の順に削除する必要がある。
 */
export async function deleteAttachment(
  taskId: string,
  attachment: Pick<Attachment, "id" | "storagePath">,
): Promise<void> {
  await deleteObject(ref(getFirebaseStorage(), attachment.storagePath));
  await deleteDoc(doc(getDb(), "tasks", taskId, "attachments", attachment.id));
}
