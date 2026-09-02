/**
 * Cloud Functions for Firebase — エントリポイント。
 *
 * Phase 6 — 通知
 *   - onTaskWritten         : タスクの新規割り当て / 完了時に通知
 *   - dailyDueReminder      : 毎朝 9:00 JST、期日 2日前・当日の未完了タスクの担当者へ
 *   - sendTestNotification  : 疎通確認用のテスト送信（呼び出し可能関数）
 *
 * Phase 7 で追加予定
 *   - onProjectVisibilityChanged : プロジェクト公開範囲変更時に配下タスクを自動追従
 *   - onProjectSoftDeleted       : プロジェクト論理削除/復元を配下タスクへ連動
 *   - purgeTrashedDocuments      : 30日経過の論理削除ドキュメントと Storage 実体を完全削除
 *
 * リージョンは asia-northeast1（東京）。
 */
import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";

initializeApp();
setGlobalOptions({ region: "asia-northeast1", maxInstances: 10 });

export { onTaskWritten } from "./taskTriggers";
export { dailyDueReminder } from "./scheduled";
export { sendTestNotification } from "./callable";
