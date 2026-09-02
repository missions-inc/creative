/**
 * コメント投稿時の通知。
 *
 * 文面: 「〇〇（タスク名）」に「△△（コメント者名）」がコメントしました
 * 通知先: タスクの担当者 ＋ 作成者 ＋ そのタスクに既にコメントした人
 *         （投稿者自身は除く。論理削除済みコメントの投稿者は数えない）
 *
 * onTaskWritten と同じ方式（Firestore トリガー + notifyUsers）で実装。
 * 編集・論理削除では発火しないよう onDocumentCreated を使う。
 */
import { getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";

import { notifyUsers } from "./notifications";

/** 通知文面に入れるテキストの上限（長文で通知が溢れないように）。 */
function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export const onCommentCreated = onDocumentCreated(
  "tasks/{taskId}/comments/{commentId}",
  async (event) => {
    const taskId = event.params.taskId;
    const comment = event.data?.data() as
      | { authorUid?: string; body?: string; isDeleted?: boolean }
      | undefined;
    if (!comment || comment.isDeleted || !comment.authorUid) return;

    const db = getFirestore();

    // 親タスク（削除済みなら通知しない）。
    const taskSnap = await db.collection("tasks").doc(taskId).get();
    if (!taskSnap.exists) return;
    const task = taskSnap.data() as {
      title?: string;
      assignees?: string[];
      createdBy?: string;
      isDeleted?: boolean;
    };
    if (task.isDeleted) return;

    // 投稿者の表示名。
    const authorSnap = await db.collection("users").doc(comment.authorUid).get();
    const authorName =
      (authorSnap.get("displayName") as string | null) ??
      (authorSnap.get("email") as string | undefined) ??
      "メンバー";

    // 既にコメントした人（論理削除済みコメントの投稿者は含めない）。
    const commentsSnap = await db
      .collection("tasks")
      .doc(taskId)
      .collection("comments")
      .get();
    const commenters = commentsSnap.docs
      .filter((d) => d.get("isDeleted") !== true)
      .map((d) => d.get("authorUid") as string | undefined)
      .filter((uid): uid is string => Boolean(uid));

    // 担当者 + 作成者 + 既存コメント投稿者、から投稿者自身を除く。
    const recipients = new Set<string>([
      ...(task.assignees ?? []),
      ...(task.createdBy ? [task.createdBy] : []),
      ...commenters,
    ]);
    recipients.delete(comment.authorUid);
    if (recipients.size === 0) return;

    const taskTitle = truncate(task.title ?? "(無題のタスク)", 40);
    const sent = await notifyUsers({
      toUids: Array.from(recipients),
      type: "commented",
      taskId,
      title: `「${taskTitle}」に「${authorName}」がコメントしました`,
      body: truncate(comment.body ?? "", 100),
    });

    logger.info("コメント通知を送信", {
      taskId,
      author: comment.authorUid,
      recipients: recipients.size,
      pushed: sent,
    });
  },
);
