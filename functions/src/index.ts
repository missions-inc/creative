/**
 * Cloud Functions for Firebase — エントリポイント。
 *
 * 実装予定（後続フェーズ）:
 *   Phase 6 — 通知
 *     - onTaskAssigned      : タスク新規割り当て時に担当者へプッシュ通知
 *     - onTaskCompleted     : タスク完了時に作成者＋全担当者へ通知
 *     - dailyDueReminder    : 毎朝 9:00 JST、期日 2日前・当日の未完了タスク担当者へ通知
 *   Phase 7 — 削除・自動処理
 *     - onProjectVisibilityChanged : プロジェクト公開範囲変更時に配下タスクを自動追従
 *     - onProjectSoftDeleted        : プロジェクト論理削除/復元を配下タスクへ連動
 *     - purgeTrashedDocuments       : 30日経過の論理削除ドキュメントと Storage 実体を完全削除
 *
 * リージョンは asia-northeast1（東京）を基本とする。
 */

import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({ region: "asia-northeast1", maxInstances: 10 });

// 各関数は後続フェーズで下記のように再エクスポートする。
// export { onTaskAssigned, onTaskCompleted, dailyDueReminder } from "./notifications";
// export { onProjectVisibilityChanged, purgeTrashedDocuments } from "./maintenance";
