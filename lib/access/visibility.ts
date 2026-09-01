/**
 * =============================================================================
 * アクセス制御（公開範囲）の判定ロジック — このアプリの中核（仕様書 §3.3 / §6）
 * -----------------------------------------------------------------------------
 * ここが「唯一の真実」。同じ判定条件を
 *   1) クライアント表示（この TS）
 *   2) Firestore セキュリティルール（firestore.rules）
 *   3) 一部の Cloud Functions（Phase 7 の公開範囲自動追従）
 * の 3 箇所で一貫させる。ルールを変更したら必ず両方を合わせること。
 *
 * 確定した境界ルール（仕様書 §3.3）:
 *   (1) 担当者は常にアクセス可:
 *         アクセス可 = ( visibility で許可される ) OR ( assignees に含まれる )
 *   (2) 狭める方向のみ:
 *         タスクの visibility は、所属プロジェクトの visibility と同じか、より狭い範囲のみ有効。
 *   (3) プロジェクト変更時の自動追従（Cloud Functions・Phase 7）。
 * =============================================================================
 */
import type { Role, Visibility, VisibilityMode } from "@/types";

/**
 * 公開範囲 `v` が、ロール `role` / UID `uid` のユーザーに閲覧を許可するか。
 * （担当者常時アクセスは含まない。呼び出し側で OR を取る。）
 */
export function visibilityAllows(
  v: Visibility,
  role: Role,
  uid: string,
): boolean {
  switch (v.mode) {
    case "all":
      return true;
    case "role_limited":
      return v.roles.includes(role);
    case "member_limited":
      return v.memberUids.includes(uid);
    default:
      return false;
  }
}

/** プロジェクトへのアクセス可否。admin は常に可。 */
export function canAccessProject(
  projectVisibility: Visibility,
  role: Role,
  uid: string,
): boolean {
  if (role === "admin") return true;
  return visibilityAllows(projectVisibility, role, uid);
}

/**
 * タスクへのアクセス可否。
 *   admin は常に可 / 担当者は常に可（境界ルール1）/ それ以外は task.visibility に従う。
 * （task.visibility ⊆ project.visibility は書き込み時に保証されるため、
 *   非担当者が task.visibility を満たせば project へのアクセスも自動的に満たす。）
 */
export function canAccessTask(
  taskVisibility: Visibility,
  assignees: string[],
  role: Role,
  uid: string,
): boolean {
  if (role === "admin") return true;
  if (assignees.includes(uid)) return true;
  return visibilityAllows(taskVisibility, role, uid);
}

/**
 * 境界ルール2「狭める方向のみ」の判定。
 * `child` が `parent` と同じか、より狭い（部分集合）なら true。
 *
 * ※ セキュリティルールでも安価に検証できるよう、健全性（＝絶対に広げない）を最優先した
 *    保守的な定義にしている。理論上は狭いが検証できないケース
 *    （role_limited の親に、その全員が該当ロールである member_limited の子）は
 *    ルール側では拒否される。そのような「特定個人に限定」は担当者（assignees）で表現する
 *    （担当者は常時アクセス可）。この判定は firestore.rules の isNarrowerOrEqual と一致させること。
 */
export function isNarrowerOrEqual(child: Visibility, parent: Visibility): boolean {
  // 親が all なら、子は何でも（all / role_limited / member_limited）許容。
  if (parent.mode === "all") return true;

  if (parent.mode === "role_limited") {
    // 子も role_limited で、そのロール集合が親の部分集合であること。
    if (child.mode === "role_limited") {
      return child.roles.every((r) => parent.roles.includes(r));
    }
    // all（広い）/ member_limited（ロール検証不可）は拒否。
    return false;
  }

  // parent.mode === "member_limited"
  if (child.mode === "member_limited") {
    return child.memberUids.every((u) => parent.memberUids.includes(u));
  }
  // all / role_limited は親の指定メンバー以外を含みうるため拒否。
  return false;
}

/** visibility の構造が妥当か（型・必須フィールド）を検証。 */
export function isValidVisibility(v: unknown): v is Visibility {
  if (!v || typeof v !== "object") return false;
  const mode = (v as { mode?: unknown }).mode;
  if (mode === "all") return true;
  if (mode === "role_limited") {
    const roles = (v as { roles?: unknown }).roles;
    return (
      Array.isArray(roles) &&
      roles.every((r) => r === "admin" || r === "pm" || r === "member")
    );
  }
  if (mode === "member_limited") {
    const uids = (v as { memberUids?: unknown }).memberUids;
    return Array.isArray(uids) && uids.every((u) => typeof u === "string");
  }
  return false;
}

/** タスク作成時の既定 visibility（プロジェクトの visibility を継承）。 */
export function inheritVisibility(projectVisibility: Visibility): Visibility {
  return projectVisibility;
}

// ---------------------------------------------------------------------------
// UI 用ヘルパー（「狭める方向のみ」へユーザーを誘導するため）
// isNarrowerOrEqual と必ず整合させること。
// ---------------------------------------------------------------------------

/**
 * 親 visibility のもとで、子が選択できるモード一覧。
 *   親 all            → all / role_limited / member_limited
 *   親 role_limited   → role_limited のみ（ロールは親の部分集合）
 *   親 member_limited → member_limited のみ（メンバーは親の部分集合）
 * 親が無い（プロジェクト自身）場合は全モード選択可。
 */
export function allowedChildModes(parent?: Visibility): VisibilityMode[] {
  if (!parent || parent.mode === "all") {
    return ["all", "role_limited", "member_limited"];
  }
  if (parent.mode === "role_limited") return ["role_limited"];
  return ["member_limited"];
}

/** 親のもとで選択可能なロール一覧。 */
export function selectableRoles(parent?: Visibility): Role[] {
  if (!parent || parent.mode === "all") return ["admin", "pm", "member"];
  if (parent.mode === "role_limited") return parent.roles;
  return [];
}

/**
 * 親のもとで選択可能なメンバー UID 一覧。
 * null を返す場合は「制限なし（全メンバーから選択可）」を意味する。
 */
export function selectableMemberUids(parent?: Visibility): string[] | null {
  if (!parent || parent.mode === "all") return null;
  if (parent.mode === "member_limited") return parent.memberUids;
  return [];
}

/**
 * 子 visibility が親に対して妥当かを検証し、UI 表示用のエラーメッセージを返す。
 * 問題なければ null。
 */
export function validateNarrowing(
  child: Visibility,
  parent?: Visibility,
): string | null {
  if (!isValidVisibility(child)) return "公開範囲の設定が不正です。";
  if (!parent) return null;
  if (isNarrowerOrEqual(child, parent)) return null;

  if (parent.mode === "role_limited" && child.mode === "member_limited") {
    return "ロール限定のプロジェクトでは、タスクをメンバー限定にできません（各メンバーのロールを検証できないため）。特定の人だけに見せたい場合は担当者に設定してください（担当者は常にアクセスできます）。";
  }
  return "タスクの公開範囲は、プロジェクトの公開範囲と同じか、より狭い範囲にしてください。";
}
