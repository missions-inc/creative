import "server-only";

/**
 * Firebase Admin SDK の初期化（サーバー実行専用）。
 * Next.js の Route Handlers / Server Actions から利用する。
 * 認証情報は原則 Application Default Credentials（デプロイ環境で自動付与）。
 * ローカルでは GOOGLE_APPLICATION_CREDENTIALS にサービスアカウント鍵のパスを指定。
 *
 * 注意: このファイルはクライアントバンドルに含めてはいけない（"server-only" で保護）。
 */
import {
  cert,
  getApp,
  getApps,
  initializeApp,
  applicationDefault,
  type App,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let cachedAdminApp: App | null = null;

function initAdminApp(): App {
  if (getApps().length) return getApp();

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  // Application Default Credentials を使用。
  // ローカルでは GOOGLE_APPLICATION_CREDENTIALS（サービスアカウント鍵のパス）を
  // 設定すれば applicationDefault() がそれを自動的に読み込む。
  // デプロイ環境（Cloud Functions / Cloud Run）では自動的に認証情報が付与される。
  return initializeApp({
    credential: applicationDefault(),
    projectId,
    storageBucket,
  });
}

export function getAdminApp(): App {
  if (cachedAdminApp) return cachedAdminApp;
  cachedAdminApp = initAdminApp();
  return cachedAdminApp;
}

export const getAdminAuth = () => getAuth(getAdminApp());
export const getAdminDb = () => getFirestore(getAdminApp());
export const getAdminStorage = () => getStorage(getAdminApp());

// cert は将来サービスアカウント JSON を直接渡す構成に切り替える際に使用する。
export { cert };
