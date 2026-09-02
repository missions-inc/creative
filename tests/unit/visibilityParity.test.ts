import { describe, expect, it } from "vitest";

import { isNarrowerOrEqual as appImpl } from "@/lib/access/visibility";
import {
  isNarrowerOrEqual as fnImpl,
  visibilityEquals,
  type Visibility,
} from "../../functions/src/shared/visibility";

/**
 * lib/access/visibility.ts（アプリ）と functions/src/shared/visibility.ts
 * （Cloud Functions の公開範囲自動追従で使用）は別パッケージのため実装が分かれている。
 * 「狭める方向のみ」の判定がずれると、ルール・UI・自動追従の間で不整合が起きるため、
 * 全モードの組み合わせで判定が一致することを固定する。
 */

const all: Visibility = { mode: "all" };
const roles = (...r: ("admin" | "pm" | "member")[]): Visibility => ({
  mode: "role_limited",
  roles: r,
});
const members = (...u: string[]): Visibility => ({
  mode: "member_limited",
  memberUids: u,
});

const CASES: Visibility[] = [
  all,
  roles(),
  roles("pm"),
  roles("admin", "pm"),
  roles("admin", "pm", "member"),
  members(),
  members("u1"),
  members("u1", "u2"),
  members("u2", "u3"),
];

describe("isNarrowerOrEqual: アプリ実装と Functions 実装の一致", () => {
  it("全組み合わせで判定が一致する", () => {
    for (const child of CASES) {
      for (const parent of CASES) {
        expect(
          fnImpl(child, parent),
          `child=${JSON.stringify(child)} parent=${JSON.stringify(parent)}`,
        ).toBe(appImpl(child, parent));
      }
    }
  });

  it("代表ケースの期待値（仕様の再確認）", () => {
    // 狭める方向は許可
    expect(fnImpl(roles("pm"), roles("admin", "pm"))).toBe(true);
    expect(fnImpl(members("u1"), members("u1", "u2"))).toBe(true);
    // 広げる方向は拒否
    expect(fnImpl(all, roles("pm"))).toBe(false);
    expect(fnImpl(members("u1", "u3"), members("u1", "u2"))).toBe(false);
    // role_limited 親への member_limited 子は保守的に拒否
    expect(fnImpl(members("u1"), roles("pm"))).toBe(false);
  });
});

describe("visibilityEquals（自動追従のトリガー判定）", () => {
  it("同一範囲は順不同でも等しい", () => {
    expect(visibilityEquals(roles("admin", "pm"), roles("pm", "admin"))).toBe(true);
    expect(visibilityEquals(members("u1", "u2"), members("u2", "u1"))).toBe(true);
    expect(visibilityEquals(all, all)).toBe(true);
  });

  it("範囲が違えば等しくない", () => {
    expect(visibilityEquals(roles("pm"), roles("admin", "pm"))).toBe(false);
    expect(visibilityEquals(all, roles("admin", "pm", "member"))).toBe(false);
    expect(visibilityEquals(members("u1"), members("u2"))).toBe(false);
  });
});
