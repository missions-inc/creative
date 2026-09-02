/**
 * 公開範囲（visibility）の判定 — Cloud Functions 側（純粋関数・依存なし）。
 *
 * ⚠️ 唯一の真実は lib/access/visibility.ts（アプリ側）。
 *    Cloud Functions は別パッケージのためここに同じ定義を置いており、
 *    両者が一致することを tests/unit/visibilityParity.test.ts で突き合わせている。
 *    片方を変更したら必ずもう片方も変更すること。
 */

export type Role = "admin" | "pm" | "member";

export type Visibility =
  | { mode: "all" }
  | { mode: "role_limited"; roles: Role[] }
  | { mode: "member_limited"; memberUids: string[] };

/**
 * 境界ルール2「狭める方向のみ」: child が parent と同じか、より狭いか。
 * lib/access/visibility.ts の isNarrowerOrEqual と一致させること。
 */
export function isNarrowerOrEqual(child: Visibility, parent: Visibility): boolean {
  if (parent.mode === "all") return true;

  if (parent.mode === "role_limited") {
    if (child.mode === "role_limited") {
      return child.roles.every((r) => parent.roles.includes(r));
    }
    return false;
  }

  // parent.mode === "member_limited"
  if (child.mode === "member_limited") {
    return child.memberUids.every((u) => parent.memberUids.includes(u));
  }
  return false;
}

/** 2 つの visibility が同じ範囲を表すか（配列は順不同で比較）。 */
export function visibilityEquals(a: Visibility, b: Visibility): boolean {
  if (a.mode !== b.mode) return false;
  if (a.mode === "all") return true;
  if (a.mode === "role_limited" && b.mode === "role_limited") {
    return sameMembers(a.roles, b.roles);
  }
  if (a.mode === "member_limited" && b.mode === "member_limited") {
    return sameMembers(a.memberUids, b.memberUids);
  }
  return false;
}

function sameMembers(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((x) => set.has(x));
}
