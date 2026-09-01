/**
 * Firebase Web SDK の公開設定値。
 * NEXT_PUBLIC_ 変数から読み込む（これらは公開前提の値であり、
 * 実際のアクセス制御は Firestore / Storage のセキュリティルールで担保する）。
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} as const;

/** 許可するメールドメイン（仕様: missions.co.jp のみ）。 */
export const ALLOWED_EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN ?? "missions.co.jp";

/** 初期管理者メール。初回ログイン時にこのアカウントだけ admin を自動付与する。 */
export const BOOTSTRAP_ADMIN_EMAIL =
  process.env.NEXT_PUBLIC_BOOTSTRAP_ADMIN_EMAIL ?? "s.matsumoto@missions.co.jp";

/** FCM Web Push の VAPID 公開鍵（Phase 6 で使用）。 */
export const FIREBASE_VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/** ローカルエミュレータに接続するか。 */
export const USE_FIREBASE_EMULATORS =
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

/** メールが許可ドメインに属するか判定する。 */
export function isAllowedDomain(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN.toLowerCase()}`);
}
