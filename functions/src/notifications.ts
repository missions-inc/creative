/**
 * 通知送信の共通処理（仕様書 §3.10）。
 *
 * - 送信先ユーザーの FCM トークンを users/{uid}/fcmTokens から集める
 * - Web Push（FCM）で送信し、無効になったトークンは掃除する
 * - アプリ内通知として notifications コレクションにも記録する
 *   （notifications への書き込みはルール上クライアント禁止。Admin SDK のみ）
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import * as logger from "firebase-functions/logger";

export type NotificationType = "assigned" | "completed" | "reminder" | "commented";

/** 通知クリック時に開くアプリの URL。デプロイ環境に合わせて設定可能。 */
const APP_BASE_URL =
  process.env.APP_BASE_URL ?? "https://missions-coorpolate.web.app";

interface TokenEntry {
  token: string;
  docPath: string;
}

/** 対象ユーザーの FCM トークンを集める。 */
async function collectTokens(uids: string[]): Promise<TokenEntry[]> {
  const db = getFirestore();
  const entries: TokenEntry[] = [];

  await Promise.all(
    uids.map(async (uid) => {
      const snap = await db.collection(`users/${uid}/fcmTokens`).get();
      for (const doc of snap.docs) {
        const token = doc.get("token");
        if (typeof token === "string" && token.length > 0) {
          entries.push({ token, docPath: doc.ref.path });
        }
      }
    }),
  );

  // 同じ端末が複数ユーザーに紐づくことは通常ないが、念のため重複を除く。
  const seen = new Set<string>();
  return entries.filter((e) => {
    if (seen.has(e.token)) return false;
    seen.add(e.token);
    return true;
  });
}

/** 期限切れ・無効なトークンを削除する。 */
async function cleanupInvalidTokens(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const db = getFirestore();
  await Promise.all(
    paths.map((p) =>
      db
        .doc(p)
        .delete()
        .catch((e) => logger.warn("トークンの削除に失敗", { path: p, e })),
    ),
  );
}

/**
 * Web Push のみを送る（アプリ内通知は記録しない）。
 * 無効になったトークンはこの中で削除される。
 */
export async function pushToUsers(params: {
  toUids: string[];
  title: string;
  body: string;
  link?: string;
  tag?: string;
  data?: Record<string, string>;
}): Promise<{ success: number; failure: number; tokens: number }> {
  const uids = Array.from(new Set(params.toUids)).filter(Boolean);
  if (uids.length === 0) return { success: 0, failure: 0, tokens: 0 };

  const entries = await collectTokens(uids);
  if (entries.length === 0) {
    logger.info("送信先トークンなし", { uids });
    return { success: 0, failure: 0, tokens: 0 };
  }

  const link = params.link ?? APP_BASE_URL;
  const response = await getMessaging().sendEachForMulticast({
    tokens: entries.map((e) => e.token),
    // Web では webpush の設定が使われる。
    webpush: {
      notification: {
        title: params.title,
        body: params.body,
        icon: "/icon-192.png",
        ...(params.tag ? { tag: params.tag } : {}),
      },
      fcmOptions: { link },
    },
    data: { url: link, ...(params.data ?? {}) },
  });

  const stale: string[] = [];
  response.responses.forEach((r, i) => {
    const code = r.error?.code;
    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token" ||
      code === "messaging/invalid-argument"
    ) {
      stale.push(entries[i].docPath);
    } else if (r.error) {
      logger.warn("プッシュ送信に失敗", { code, message: r.error.message });
    }
  });
  await cleanupInvalidTokens(stale);

  return {
    success: response.successCount,
    failure: response.failureCount,
    tokens: entries.length,
  };
}

/**
 * 指定ユーザーへ通知を送る（アプリ内通知の記録 + Web Push）。
 * @returns プッシュ送信に成功した件数
 */
export async function notifyUsers(params: {
  toUids: string[];
  type: NotificationType;
  taskId: string;
  title: string;
  body: string;
}): Promise<number> {
  const db = getFirestore();
  const uids = Array.from(new Set(params.toUids)).filter(Boolean);
  if (uids.length === 0) return 0;

  // 1) アプリ内通知の記録（プッシュが届かなくても履歴は残る）
  const batch = db.batch();
  for (const uid of uids) {
    batch.set(db.collection("notifications").doc(), {
      toUid: uid,
      type: params.type,
      taskId: params.taskId,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  // 2) Web Push 送信
  const result = await pushToUsers({
    toUids: uids,
    title: params.title,
    body: params.body,
    link: `${APP_BASE_URL}/tasks/${params.taskId}`,
    tag: `task-${params.taskId}-${params.type}`,
    data: { taskId: params.taskId, type: params.type },
  });

  logger.info("通知を送信", {
    type: params.type,
    taskId: params.taskId,
    recipients: uids.length,
    ...result,
  });

  return result.success;
}
