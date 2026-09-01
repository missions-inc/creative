import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { type Firestore, Timestamp } from "firebase/firestore";

export const PROJECT_ID = "task-mgmt-rules-test";

export const ADMIN_EMAIL = "s.matsumoto@missions.co.jp";

/** テスト用ユーザー定義。role は Firestore の users ドキュメントに保存される。 */
export const USERS = {
  admin: { uid: "admin-uid", email: ADMIN_EMAIL, role: "admin" as const },
  pm: { uid: "pm-uid", email: "pm@missions.co.jp", role: "pm" as const },
  member: {
    uid: "member-uid",
    email: "member@missions.co.jp",
    role: "member" as const,
  },
  member2: {
    uid: "member2-uid",
    email: "member2@missions.co.jp",
    role: "member" as const,
  },
};

export async function createTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
}

/** missions.co.jp の検証済みアカウントとして Firestore を取得。 */
export function authed(
  env: RulesTestEnvironment,
  uid: string,
  email: string,
): Firestore {
  return env
    .authenticatedContext(uid, { email, email_verified: true })
    .firestore() as unknown as Firestore;
}

/** ドメイン外アカウント（検証済みだが missions.co.jp ではない）。 */
export function authedOutsider(
  env: RulesTestEnvironment,
  uid: string,
  email: string,
): Firestore {
  return env
    .authenticatedContext(uid, { email, email_verified: true })
    .firestore() as unknown as Firestore;
}

/**
 * ルールを無効化した状態で初期データを投入する。
 * users（role 付き）と、任意の projects/tasks を用意する。
 */
export async function seed(env: RulesTestEnvironment) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const { setDoc, doc } = await import("firebase/firestore");
    for (const u of Object.values(USERS)) {
      await setDoc(doc(db, "users", u.uid), {
        email: u.email,
        displayName: u.email,
        role: u.role,
        createdAt: Timestamp.now(),
      });
    }
  });
}

/** テスト用の Timestamp。 */
export const now = () => Timestamp.now();
