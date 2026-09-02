/**
 * Cloud Functions for Firebase — エントリポイント。
 *
 * Phase 6 — 通知
 *   - onTaskWritten         : タスクの新規割り当て / 完了時に通知
 *   - dailyDueReminder      : 毎朝 9:00 JST。期日リマインド（プッシュ）+
 *                             担当者別デイリーダイジェスト（メール）
 *   - sendTestNotification  : 疎通確認用のテスト送信（呼び出し可能関数）
 *
 * Phase 7 — 削除・ゴミ箱・自動処理
 *   - onProjectWritten      : プロジェクトの論理削除/復元を配下タスクへ連動 +
 *                             公開範囲変更時の自動追従（境界ルール3）
 *   - purgeTrash            : 毎日 4:00 JST。30日経過した論理削除ドキュメントと
 *                             Storage 実体の完全削除
 *
 * リージョンは asia-northeast1（東京）／ランタイムは Node.js 22。
 */
import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";

initializeApp();
setGlobalOptions({ region: "asia-northeast1", maxInstances: 10 });

export { onTaskWritten } from "./taskTriggers";
export { dailyDueReminder } from "./scheduled";
export { sendTestNotification } from "./callable";
export { onProjectWritten } from "./projectTriggers";
export { purgeTrash } from "./purge";
