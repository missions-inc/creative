/**
 * =============================================================================
 * 添付ファイルの制約（仕様書 §3.6）
 * -----------------------------------------------------------------------------
 * - 1 ファイル最大 10MB
 * - 1 タスク最大 10 ファイル
 * - 許可形式: 画像(jpg/png/gif/webp) / PDF / Office(Word,Excel,PowerPoint) / ZIP
 *
 * ⚠️ MIME タイプの一覧は firestore.rules の isAllowedAttachmentType および
 *    storage.rules の isAllowedType と**必ず一致**させること。
 *    サイズ制限もルール側で二重に検証している。
 *
 * ファイル数の上限だけはセキュリティルールで件数を数えられないため
 * クライアント側の検証のみ（アップロード前に既存件数をチェックする）。
 * =============================================================================
 */

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_TASK = 10;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
] as const;

/** <input type="file"> の accept 属性用。 */
export const ATTACHMENT_ACCEPT = [
  ...ALLOWED_ATTACHMENT_MIME_TYPES,
  // 一部ブラウザで ZIP の MIME が空になることがあるため拡張子も許可する。
  ".zip",
].join(",");

export const ALLOWED_ATTACHMENT_LABEL =
  "画像（JPG/PNG/GIF/WebP）、PDF、Word/Excel/PowerPoint、ZIP";

export function isAllowedAttachmentType(contentType: string): boolean {
  return (ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(
    contentType,
  );
}

/**
 * アップロード前の検証。問題があればエラーメッセージ、なければ null。
 * @param currentCount そのタスクに既に添付されている件数
 */
export function validateAttachmentFile(
  file: { name: string; size: number; type: string },
  currentCount: number,
): string | null {
  if (currentCount >= MAX_ATTACHMENTS_PER_TASK) {
    return `添付は1タスクにつき最大 ${MAX_ATTACHMENTS_PER_TASK} ファイルまでです。`;
  }
  if (file.size <= 0) {
    return "空のファイルはアップロードできません。";
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return `ファイルサイズは ${formatFileSize(MAX_ATTACHMENT_SIZE_BYTES)} 以下にしてください（${file.name}: ${formatFileSize(file.size)}）。`;
  }
  if (!isAllowedAttachmentType(file.type)) {
    return `この形式はアップロードできません（${file.name}）。対応形式: ${ALLOWED_ATTACHMENT_LABEL}`;
  }
  return null;
}

/** バイト数を人が読める形式に。 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Storage 上の保存パス。storage.rules の match と一致させること。 */
export function attachmentStoragePath(
  taskId: string,
  attachmentId: string,
  fileName: string,
): string {
  return `task-attachments/${taskId}/${attachmentId}/${sanitizeFileName(fileName)}`;
}

/** パス区切りなど、Storage パスで問題になる文字を除去する。 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[/\\]/g, "_").slice(0, 200) || "file";
}
