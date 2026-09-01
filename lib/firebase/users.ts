"use client";

/**
 * users/{uid} ドキュメントの作成・取得。
 *
 * ブートストラップ（仕様書 §3.1）:
 *   - 初回ログイン時に users/{uid} を作成する。
 *   - 初期管理者メール（BOOTSTRAP_ADMIN_EMAIL）は role="admin" を自動付与。
 *   - それ以外の新規ユーザーの初期ロールは "member"。
 *
 * セキュリティ:
 *   role の自己昇格を防ぐため、Firestore ルール側でも
 *   「admin を名乗れるのは BOOTSTRAP_ADMIN_EMAIL のみ／それ以外は member 固定」
 *   を強制する（Phase 2）。ここでのクライアント判定は UI 用の一次的なもの。
 */
import type { User } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import type { AppUser, Role } from "@/types";
import { BOOTSTRAP_ADMIN_EMAIL } from "./config";
import { getDb } from "./client";

/** メールから初期ロールを決定する。 */
export function initialRoleForEmail(email: string): Role {
  return email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()
    ? "admin"
    : "member";
}

/**
 * users/{uid} が無ければ作成し、AppUser を返す。
 * 既存ドキュメントがある場合は role を変更しない（Admin による権限変更を尊重）。
 */
export async function ensureUserDocument(user: User): Promise<AppUser> {
  const db = getDb();
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return { uid: user.uid, ...(snap.data() as Omit<AppUser, "uid">) };
  }

  const email = user.email ?? "";
  const role = initialRoleForEmail(email);

  await setDoc(ref, {
    email,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null,
    role,
    createdAt: serverTimestamp(),
  });

  // 作成直後の読み出しでサーバータイムスタンプを確定させる。
  const created = await getDoc(ref);
  return { uid: user.uid, ...(created.data() as Omit<AppUser, "uid">) };
}
