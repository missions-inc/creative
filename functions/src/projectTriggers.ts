/**
 * プロジェクトの変更を配下タスクへ連動させる（仕様書 §3.3 境界ルール3・§3.8）。
 *
 *   1. 論理削除の連動: プロジェクトをゴミ箱へ → 配下タスクも連動してゴミ箱へ。
 *      復元も連動する。ただし「プロジェクト削除より前に個別に削除されていたタスク」は
 *      復元しない（連動削除したタスクに deletedByProject マーカーを付けて区別する）。
 *
 *   2. 公開範囲の自動追従: プロジェクトの visibility を狭めたとき、
 *      はみ出す配下タスクは自動的にその範囲内（= プロジェクトと同じ visibility）へ収める。
 *      個別に狭めていたタスク（引き続き範囲内のもの）はそのまま維持する。
 */
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";

import {
  isNarrowerOrEqual,
  visibilityEquals,
  type Visibility,
} from "./shared/visibility";

interface ProjectData {
  visibility?: Visibility;
  isDeleted?: boolean;
}

/** Firestore のバッチ上限（500）に余裕を持たせたチャンクサイズ。 */
const BATCH_LIMIT = 400;

export const onProjectWritten = onDocumentWritten(
  "projects/{projectId}",
  async (event) => {
    const projectId = event.params.projectId;
    const before = event.data?.before.exists
      ? (event.data.before.data() as ProjectData)
      : undefined;
    const after = event.data?.after.exists
      ? (event.data.after.data() as ProjectData)
      : undefined;

    // 作成・物理削除では連動しない（物理削除は purge バッチが配下ごと処理する）。
    if (!before || !after) return;

    const db = getFirestore();

    // --- 1. 論理削除／復元の連動 -------------------------------------------
    if (!before.isDeleted && after.isDeleted) {
      // まだ削除されていない配下タスクだけを連動削除し、マーカーを付ける。
      const snap = await db
        .collection("tasks")
        .where("projectId", "==", projectId)
        .where("isDeleted", "==", false)
        .get();

      await applyInChunks(snap.docs, (batch, doc) =>
        batch.update(doc.ref, {
          isDeleted: true,
          deletedAt: FieldValue.serverTimestamp(),
          deletedByProject: true,
          updatedAt: FieldValue.serverTimestamp(),
        }),
      );
      logger.info("プロジェクト削除に連動してタスクをゴミ箱へ", {
        projectId,
        tasks: snap.size,
      });
    } else if (before.isDeleted && !after.isDeleted) {
      // 連動削除されたタスク（deletedByProject == true）のみ復元する。
      const snap = await db
        .collection("tasks")
        .where("projectId", "==", projectId)
        .where("deletedByProject", "==", true)
        .get();

      await applyInChunks(snap.docs, (batch, doc) =>
        batch.update(doc.ref, {
          isDeleted: false,
          deletedAt: null,
          deletedByProject: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        }),
      );
      logger.info("プロジェクト復元に連動してタスクを復元", {
        projectId,
        tasks: snap.size,
      });
    }

    // --- 2. 公開範囲の自動追従（境界ルール3） -------------------------------
    const beforeVis = before.visibility;
    const afterVis = after.visibility;
    if (beforeVis && afterVis && !visibilityEquals(beforeVis, afterVis)) {
      const snap = await db
        .collection("tasks")
        .where("projectId", "==", projectId)
        .get();

      // 新しいプロジェクト範囲からはみ出すタスクだけを、プロジェクトと同じ範囲へ収める。
      // （範囲内に収まっている個別設定はそのまま維持する）
      const outOfRange = snap.docs.filter((doc) => {
        const vis = doc.get("visibility") as Visibility | undefined;
        return !vis || !isNarrowerOrEqual(vis, afterVis);
      });

      await applyInChunks(outOfRange, (batch, doc) =>
        batch.update(doc.ref, {
          visibility: afterVis,
          updatedAt: FieldValue.serverTimestamp(),
        }),
      );

      if (outOfRange.length > 0) {
        logger.info("公開範囲の変更に合わせて配下タスクを追従", {
          projectId,
          adjusted: outOfRange.length,
          scanned: snap.size,
        });
      }
    }
  },
);

/** バッチ上限を超えないようチャンクに分けて書き込む。 */
async function applyInChunks<T extends { ref: FirebaseFirestore.DocumentReference }>(
  docs: T[],
  apply: (batch: FirebaseFirestore.WriteBatch, doc: T) => void,
): Promise<void> {
  const db = getFirestore();
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const doc of docs.slice(i, i + BATCH_LIMIT)) {
      apply(batch, doc);
    }
    await batch.commit();
  }
}
