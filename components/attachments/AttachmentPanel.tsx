"use client";

import { useRef, useState } from "react";
import { Download, Paperclip, Trash2, Upload } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/loader";
import {
  ALLOWED_ATTACHMENT_LABEL,
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS_PER_TASK,
  MAX_ATTACHMENT_SIZE_BYTES,
  formatFileSize,
  validateAttachmentFile,
} from "@/lib/attachments/constraints";
import { isPmOrAbove } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/date";
import {
  deleteAttachment,
  getAttachmentDownloadUrl,
  uploadAttachment,
} from "@/lib/firebase/attachments";
import { useAttachments } from "@/hooks/useCollections";
import type { AppUser } from "@/types";

/**
 * 添付ファイル（仕様書 §3.6）。
 *   1 ファイル最大 10MB / 1 タスク最大 10 ファイル / 許可形式のみ。
 *   サイズ・形式はここでの検証に加え、Firestore ルールと Storage ルールでも制限される。
 *   ファイル数の上限はルールで件数を数えられないため、ここでのみ検証する。
 */
export function AttachmentPanel({
  taskId,
  users,
}: {
  taskId: string;
  users: AppUser[];
}) {
  const { appUser } = useAuth();
  const { data: attachments, loading, error } = useAttachments(taskId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const nameByUid = new Map(users.map((u) => [u.uid, u.displayName ?? u.email]));
  const atLimit = attachments.length >= MAX_ATTACHMENTS_PER_TASK;

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !appUser) return;
    setUploadError(null);
    setUploading(true);

    try {
      // 複数選択されても上限を超えないよう、1 件ずつ検証しながら順に処理する。
      let count = attachments.length;
      for (const file of Array.from(files)) {
        const problem = validateAttachmentFile(file, count);
        if (problem) {
          setUploadError(problem);
          break;
        }
        await uploadAttachment(taskId, file, appUser.uid);
        count += 1;
      }
    } catch (e) {
      setUploadError(
        e instanceof Error
          ? e.message
          : "アップロードに失敗しました。権限をご確認ください。",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDownload = async (storagePath: string, fileName: string) => {
    try {
      const url = await getAttachmentDownloadUrl(storagePath);
      // 別タブで開く（Storage の署名付き URL）。
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.download = fileName;
      a.click();
    } catch {
      setUploadError("ダウンロード URL の取得に失敗しました。");
    }
  };

  const onDelete = async (id: string, storagePath: string) => {
    setBusyId(id);
    setUploadError(null);
    try {
      await deleteAttachment(taskId, { id, storagePath });
    } catch (e) {
      setUploadError(
        e instanceof Error ? e.message : "削除に失敗しました。",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Paperclip className="h-4 w-4" />
        添付ファイル（{attachments.length}/{MAX_ATTACHMENTS_PER_TASK}）
      </h2>

      <div className="space-y-1.5">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
          className="hidden"
          onChange={(e) => onPickFiles(e.target.files)}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || atLimit}
        >
          {uploading ? <Spinner /> : <Upload />}
          ファイルを追加
        </Button>
        <p className="text-xs text-muted-foreground">
          1ファイル {formatFileSize(MAX_ATTACHMENT_SIZE_BYTES)} まで／1タスク{" "}
          {MAX_ATTACHMENTS_PER_TASK} ファイルまで。対応形式: {ALLOWED_ATTACHMENT_LABEL}
        </p>
        {atLimit ? (
          <p className="text-xs text-amber-700">
            添付が上限に達しています。追加するには既存のファイルを削除してください。
          </p>
        ) : null}
      </div>

      {uploadError ? (
        <p role="alert" className="text-sm text-destructive">
          {uploadError}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          添付の読み込みに失敗しました: {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">添付ファイルはありません。</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => {
            // 削除できるのはアップロード者本人 or PM 以上（ルールと一致）。
            const canDelete =
              a.uploadedBy === appUser?.uid || isPmOrAbove(appUser?.role);
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(a.size)} ・{" "}
                    {nameByUid.get(a.uploadedBy) ?? a.uploadedBy} ・{" "}
                    {formatDateTime(a.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDownload(a.storagePath, a.fileName)}
                  >
                    <Download />
                    開く
                  </Button>
                  {canDelete ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(a.id, a.storagePath)}
                      disabled={busyId === a.id}
                    >
                      {busyId === a.id ? <Spinner /> : <Trash2 />}
                      削除
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
