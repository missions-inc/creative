import type { Role } from "@/types";

/**
 * ロールに基づく権限判定ヘルパー（クライアント表示用）。
 * サーバー側の最終的なアクセス制御は Firestore セキュリティルールで担保する。
 * ここでの判定は UI の出し分け（ボタン表示など）が目的。
 */

/** admin かどうか。 */
export const isAdmin = (role: Role | null | undefined): boolean =>
  role === "admin";

/** pm 以上（pm または admin）かどうか。 */
export const isPmOrAbove = (role: Role | null | undefined): boolean =>
  role === "admin" || role === "pm";

/** プロジェクトの作成・編集・削除が可能か（pm 以上）。 */
export const canManageProjects = (role: Role | null | undefined): boolean =>
  isPmOrAbove(role);

/** クライアント登録・メンバー管理が可能か（admin のみ）。 */
export const canManageClients = (role: Role | null | undefined): boolean =>
  isAdmin(role);

/** 他人のコメントを削除できるか（pm 以上）。仕様書 §3.7。 */
export const canDeleteOthersComment = (role: Role | null | undefined): boolean =>
  isPmOrAbove(role);
