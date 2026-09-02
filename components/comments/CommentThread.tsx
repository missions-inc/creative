"use client";

import { useMemo, useState } from "react";
import { MessageSquare, Pencil, Trash2 } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/loader";
import { Textarea } from "@/components/ui/textarea";
import { canDeleteOthersComment } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/date";
import { addComment, deleteComment, editComment } from "@/lib/firebase/comments";
import { useComments } from "@/hooks/useCollections";
import type { AppUser, Comment } from "@/types";

/**
 * スレッド形式のコメント（仕様書 §3.7）。
 *   - parentId で返信をぶら下げる
 *   - 投稿者本人: 編集・削除が可能
 *   - PM 以上: 他人のコメントを「削除」のみ可能（編集は不可）
 *   - 削除は論理削除。返信のつながりを保つためプレースホルダを表示する
 */
export function CommentThread({
  taskId,
  users,
}: {
  taskId: string;
  users: AppUser[];
}) {
  const { data: comments, loading, error } = useComments(taskId);
  const nameByUid = useMemo(
    () => new Map(users.map((u) => [u.uid, u.displayName ?? u.email])),
    [users],
  );

  // parentId ごとに children をまとめる。
  const childrenByParent = useMemo(() => {
    const map = new Map<string, Comment[]>();
    for (const c of comments) {
      const key = c.parentId ?? "__root__";
      const list = map.get(key) ?? [];
      list.push(c);
      map.set(key, list);
    }
    return map;
  }, [comments]);

  const roots = childrenByParent.get("__root__") ?? [];
  const visibleCount = comments.filter((c) => !c.isDeleted).length;

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <MessageSquare className="h-4 w-4" />
        コメント（{visibleCount}）
      </h2>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          コメントの読み込みに失敗しました: {error}
        </p>
      ) : null}

      <CommentForm
        taskId={taskId}
        parentId={null}
        placeholder="コメントを入力..."
        submitLabel="投稿"
      />

      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : roots.length === 0 ? (
        <p className="text-sm text-muted-foreground">まだコメントはありません。</p>
      ) : (
        <div className="space-y-4">
          {roots.map((c) => (
            <CommentNode
              key={c.id}
              taskId={taskId}
              comment={c}
              childrenByParent={childrenByParent}
              nameByUid={nameByUid}
              depth={0}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CommentNode({
  taskId,
  comment,
  childrenByParent,
  nameByUid,
  depth,
}: {
  taskId: string;
  comment: Comment;
  childrenByParent: Map<string, Comment[]>;
  nameByUid: Map<string, string>;
  depth: number;
}) {
  const { appUser } = useAuth();
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const replies = childrenByParent.get(comment.id) ?? [];
  const isOwn = appUser?.uid === comment.authorUid;
  const canDelete = isOwn || canDeleteOthersComment(appUser?.role);
  // 返信が深くなりすぎないよう、インデントは 4 段までに留める。
  const indent = Math.min(depth, 4);

  const onDelete = async () => {
    setBusy(true);
    try {
      await deleteComment(taskId, comment.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginLeft: indent * 20 }} className="space-y-2">
      <div className="rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {nameByUid.get(comment.authorUid) ?? comment.authorUid}
          </span>
          <span>{formatDateTime(comment.createdAt)}</span>
          {comment.editedAt ? <span>(編集済み)</span> : null}
        </div>

        {comment.isDeleted ? (
          <p className="mt-2 text-sm italic text-muted-foreground">
            このコメントは削除されました
          </p>
        ) : editing ? (
          <div className="mt-2">
            <CommentForm
              taskId={taskId}
              parentId={comment.parentId}
              initialBody={comment.body}
              submitLabel="更新"
              onCancel={() => setEditing(false)}
              onSubmitOverride={async (body) => {
                await editComment(taskId, comment.id, body);
                setEditing(false);
              }}
            />
          </div>
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-sm">{comment.body}</p>
        )}

        {!comment.isDeleted && !editing ? (
          <div className="mt-2 flex flex-wrap gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReplying((v) => !v)}
            >
              返信
            </Button>
            {/* 編集は本人のみ（PM でも他人の本文は編集できない） */}
            {isOwn ? (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <Pencil />
                編集
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                disabled={busy}
              >
                {busy ? <Spinner /> : <Trash2 />}
                削除
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {replying ? (
        <div style={{ marginLeft: 20 }}>
          <CommentForm
            taskId={taskId}
            parentId={comment.id}
            placeholder="返信を入力..."
            submitLabel="返信"
            onCancel={() => setReplying(false)}
            onDone={() => setReplying(false)}
          />
        </div>
      ) : null}

      {replies.map((child) => (
        <CommentNode
          key={child.id}
          taskId={taskId}
          comment={child}
          childrenByParent={childrenByParent}
          nameByUid={nameByUid}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

function CommentForm({
  taskId,
  parentId,
  initialBody = "",
  placeholder,
  submitLabel,
  onCancel,
  onDone,
  onSubmitOverride,
}: {
  taskId: string;
  parentId: string | null;
  initialBody?: string;
  placeholder?: string;
  submitLabel: string;
  onCancel?: () => void;
  onDone?: () => void;
  /** 指定するとコメント作成ではなくこちらを実行する（編集用）。 */
  onSubmitOverride?: (body: string) => Promise<void>;
}) {
  const { appUser } = useAuth();
  const [body, setBody] = useState(initialBody);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!body.trim()) {
      setError("内容を入力してください。");
      return;
    }
    if (!appUser) return;

    setSubmitting(true);
    setError(null);
    try {
      if (onSubmitOverride) {
        await onSubmitOverride(body);
      } else {
        await addComment(taskId, { body, parentId }, appUser.uid);
        setBody("");
        onDone?.();
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "投稿に失敗しました。権限をご確認ください。",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={3}
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={submitting}>
          {submitting ? <Spinner /> : null}
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            キャンセル
          </Button>
        ) : null}
      </div>
    </div>
  );
}
