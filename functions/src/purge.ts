/**
 * ゴミ箱の完全削除バッチ（仕様書 §3.8）。
 *
 * 論理削除から 30 日経過したタスク・プロジェクトを毎日完全削除する。
 *   - タスク: コメント・添付メタのサブコレクションごとドキュメントを削除し、
 *     Storage の実体ファイル（task-attachments/{taskId}/ 配下）も削除する。
 *   - プロジェクト: ドキュメントを削除する（配下タスクはプロジェクト削除時に
 *     連動でゴミ箱入りしており、タスク側の経過日数で個別に purge される）。
 *
 * 深夜 4:00 JST に実行（ユーザー操作と重ならない時間帯）。
 */
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";

import { BUSINESS_TIME_ZONE } from "./shared/dueDates";

/** ゴミ箱の保持期間（日）。 */
export const TRASH_RETENTION_DAYS = 30;

export const purgeTrash = onSchedule(
  {
    schedule: "0 4 * * *",
    timeZone: BUSINESS_TIME_ZONE,
    region: "asia-northeast1",
    timeoutSeconds: 540,
  },
  async () => {
    const db = getFirestore();
    const cutoff = Timestamp.fromMillis(
      Date.now() - TRASH_RETENTION_DAYS * 86_400_000,
    );

    // --- タスク（サブコレクション + Storage 実体を含む） ---
    const tasks = await db
      .collection("tasks")
      .where("isDeleted", "==", true)
      .where("deletedAt", "<=", cutoff)
      .get();

    let purgedTasks = 0;
    for (const doc of tasks.docs) {
      try {
        // Storage の添付実体（プレフィックス配下を一括削除）。
        await getStorage()
          .bucket()
          .deleteFiles({ prefix: `task-attachments/${doc.id}/` });
        // ドキュメント本体 + comments / attachments サブコレクション。
        await db.recursiveDelete(doc.ref);
        purgedTasks += 1;
      } catch (e) {
        // 1 件の失敗で全体を止めない。翌日のバッチで再試行される。
        logger.error("タスクの完全削除に失敗", { taskId: doc.id, e });
      }
    }

    // --- プロジェクト ---
    const projects = await db
      .collection("projects")
      .where("isDeleted", "==", true)
      .where("deletedAt", "<=", cutoff)
      .get();

    let purgedProjects = 0;
    for (const doc of projects.docs) {
      try {
        await db.recursiveDelete(doc.ref);
        purgedProjects += 1;
      } catch (e) {
        logger.error("プロジェクトの完全削除に失敗", { projectId: doc.id, e });
      }
    }

    logger.info("ゴミ箱の完全削除を実行", {
      cutoff: cutoff.toDate().toISOString(),
      purgedTasks,
      purgedProjects,
    });
  },
);
