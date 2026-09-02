"use client";

/**
 * Web Push（FCM）のクライアント側処理（仕様書 §3.10）。
 *
 * 対象は PC の Chrome のみ（Mac / Windows 両対応）。iOS は対象外。
 * 通知処理は Chrome が仲介するため OS 別の分岐は不要。
 */
import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
} from "firebase/messaging";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";

import { firebaseConfig, FIREBASE_VAPID_KEY } from "./config";
import { getDb, getFirebaseApp } from "./client";

export type PermissionState = "granted" | "denied" | "default" | "unsupported";

/** ブラウザが Web Push に対応しているか。 */
export async function isPushSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
  return isSupported().catch(() => false);
}

/** 現在の通知許可状態。 */
export async function getPermissionState(): Promise<PermissionState> {
  if (!(await isPushSupported())) return "unsupported";
  return Notification.permission as PermissionState;
}

/**
 * Service Worker を登録する。
 * 設定値をクエリパラメータで渡す（SW はビルド時の環境変数を読めないため）。
 */
async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const params = new URLSearchParams({
    apiKey: firebaseConfig.apiKey ?? "",
    authDomain: firebaseConfig.authDomain ?? "",
    projectId: firebaseConfig.projectId ?? "",
    storageBucket: firebaseConfig.storageBucket ?? "",
    messagingSenderId: firebaseConfig.messagingSenderId ?? "",
    appId: firebaseConfig.appId ?? "",
  });
  return navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${params.toString()}`,
    { scope: "/firebase-cloud-messaging-push-scope" },
  );
}

/**
 * Firestore のドキュメント ID として安全な形に整える。
 * FCM トークンは通常 '/' を含まないが、含んだ場合にパスが壊れるのを防ぐ。
 * 元のトークンは `token` フィールドに保持する。
 */
function tokenDocId(token: string): string {
  return token.replace(/\//g, "_").slice(0, 500);
}

/**
 * 通知を有効にする。
 *   1. 通知許可をリクエスト
 *   2. Service Worker を登録
 *   3. FCM トークンを取得し users/{uid}/fcmTokens に保存
 *
 * @returns 取得したトークン。許可されなかった場合は null。
 */
export async function enableNotifications(uid: string): Promise<string | null> {
  if (!(await isPushSupported())) {
    throw new Error("このブラウザは Web プッシュ通知に対応していません。");
  }
  if (!FIREBASE_VAPID_KEY) {
    throw new Error(
      "VAPID キーが設定されていません（NEXT_PUBLIC_FIREBASE_VAPID_KEY）。",
    );
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await registerServiceWorker();
  const messaging = getMessaging(getFirebaseApp());
  const token = await getToken(messaging, {
    vapidKey: FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) return null;

  await setDoc(
    doc(getDb(), "users", uid, "fcmTokens", tokenDocId(token)),
    {
      token,
      userAgent: navigator.userAgent,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return token;
}

/** この端末の通知を無効にする（トークンを削除）。 */
export async function disableNotifications(
  uid: string,
  token: string,
): Promise<void> {
  try {
    const messaging = getMessaging(getFirebaseApp());
    await deleteToken(messaging);
  } catch {
    // トークンが既に無効な場合は無視して Firestore 側だけ掃除する。
  }
  await deleteDoc(doc(getDb(), "users", uid, "fcmTokens", tokenDocId(token)));
}

/**
 * フォアグラウンド受信。タブが開いている間はブラウザが通知を出さないため、
 * アプリ側で表示する必要がある。
 * @returns 購読解除関数
 */
export function subscribeForegroundMessages(
  handler: (payload: MessagePayload) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  try {
    const messaging = getMessaging(getFirebaseApp());
    return onMessage(messaging, handler);
  } catch {
    return () => undefined;
  }
}
