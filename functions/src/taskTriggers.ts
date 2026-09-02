/**
 * タスクの変更を監視して通知を送る（仕様書 §3.10 トリガー 1・2）。
 *
 *   1. タスクの新規割り当て時 → 割り当てられた担当者へ
 *   2. タスク完了時          → 作成者 ＋ 全担当者へ
 *
 * 1 つの onDocumentWritten で両方を扱い、トリガーの多重起動を避ける。
 */
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";

import { notifyUsers } from "./notifications";

interface TaskData {
  title?: string;
  assignees?: string[];
  status?: string;
  createdBy?: string;
  isDeleted?: boolean;
}

export const onTaskWritten = onDocumentWritten(
  "tasks/{taskId}",
  async (event) => {
    const taskId = event.params.taskId;
    const before = event.data?.before.exists
      ? (event.data.before.data() as TaskData)
      : undefined;
    const after = event.data?.after.exists
      ? (event.data.after.data() as TaskData)
      : undefined;

    // 削除された、または論理削除済みのタスクでは通知しない。
    if (!after || after.isDeleted) return;

    const title = after.title ?? "(無題のタスク)";
    const afterAssignees = after.assignees ?? [];
    const beforeAssignees = before?.assignees ?? [];

    // --- 1. 新規に割り当てられた担当者へ ---
    const newlyAssigned = afterAssignees.filter(
      (uid) => !beforeAssignees.includes(uid),
    );
    if (newlyAssigned.length > 0) {
      await notifyUsers({
        toUids: newlyAssigned,
        type: "assigned",
        taskId,
        title: "タスクが割り当てられました",
        body: title,
      });
    }

    // --- 2. 完了時に作成者＋全担当者へ ---
    const justCompleted = before?.status !== "done" && after.status === "done";
    if (justCompleted) {
      const recipients = [...afterAssignees];
      if (after.createdBy) recipients.push(after.createdBy);
      await notifyUsers({
        toUids: recipients,
        type: "completed",
        taskId,
        title: "タスクが完了しました",
        body: title,
      });
    }

    if (newlyAssigned.length === 0 && !justCompleted) {
      logger.debug("通知対象の変更なし", { taskId });
    }
  },
);
