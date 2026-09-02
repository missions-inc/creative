/**
 * 通知の疎通確認用（仕様書 §6）。
 *
 * Chrome の通知は OS の通知許可・Chrome の起動状態・集中モードに依存するため、
 * 「届かないときの切り分け」ができるようアプリから自分宛にテスト送信できるようにする。
 */
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { pushToUsers } from "./notifications";

const ALLOWED_EMAIL_DOMAIN = "missions.co.jp";

export const sendTestNotification = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    const auth = request.auth;
    if (!auth) {
      throw new HttpsError("unauthenticated", "ログインが必要です。");
    }

    const email = (auth.token.email ?? "").toLowerCase();
    if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
      throw new HttpsError(
        "permission-denied",
        `${ALLOWED_EMAIL_DOMAIN} のアカウントのみ利用できます。`,
      );
    }

    const result = await pushToUsers({
      toUids: [auth.uid],
      title: "通知テスト",
      body: "この通知が表示されていれば、プッシュ通知は正常に動作しています。",
      tag: "test-notification",
    });

    if (result.tokens === 0) {
      throw new HttpsError(
        "failed-precondition",
        "この端末の通知トークンが登録されていません。先に通知を有効にしてください。",
      );
    }

    return {
      tokens: result.tokens,
      success: result.success,
      failure: result.failure,
    };
  },
);
