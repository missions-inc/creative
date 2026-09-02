import { describe, expect, it } from "vitest";

import {
  allowedChildModes,
  canAccessTask,
  isNarrowerOrEqual,
  selectableMemberUids,
  selectableRoles,
  validateNarrowing,
  visibilityAllows,
} from "@/lib/access/visibility";
import type { Visibility } from "@/types";

const all: Visibility = { mode: "all" };
const roles = (...r: ("admin" | "pm" | "member")[]): Visibility => ({
  mode: "role_limited",
  roles: r,
});
const members = (...u: string[]): Visibility => ({
  mode: "member_limited",
  memberUids: u,
});

describe("visibilityAllows", () => {
  it("all は全員許可", () => {
    expect(visibilityAllows(all, "member", "u1")).toBe(true);
  });
  it("role_limited はロール一致のみ", () => {
    expect(visibilityAllows(roles("admin", "pm"), "pm", "u1")).toBe(true);
    expect(visibilityAllows(roles("admin", "pm"), "member", "u1")).toBe(false);
  });
  it("member_limited は UID 一致のみ", () => {
    expect(visibilityAllows(members("u1"), "member", "u1")).toBe(true);
    expect(visibilityAllows(members("u1"), "member", "u2")).toBe(false);
  });
});

describe("canAccessTask（境界ルール1: 担当者は常にアクセス可）", () => {
  it("visibility 外でも担当者ならアクセス可", () => {
    expect(canAccessTask(members("u1"), ["u2"], "member", "u2")).toBe(true);
  });
  it("visibility 外で担当者でもなければ不可", () => {
    expect(canAccessTask(members("u1"), ["u3"], "member", "u2")).toBe(false);
  });
  it("admin は常にアクセス可", () => {
    expect(canAccessTask(members("u1"), [], "admin", "u9")).toBe(true);
  });
});

describe("isNarrowerOrEqual（境界ルール2: 狭める方向のみ）", () => {
  it("親 all は何でも許容", () => {
    expect(isNarrowerOrEqual(all, all)).toBe(true);
    expect(isNarrowerOrEqual(roles("pm"), all)).toBe(true);
    expect(isNarrowerOrEqual(members("u1"), all)).toBe(true);
  });

  it("親 role_limited は部分集合の role_limited のみ", () => {
    expect(isNarrowerOrEqual(roles("pm"), roles("admin", "pm"))).toBe(true);
    expect(isNarrowerOrEqual(roles("admin", "pm"), roles("admin", "pm"))).toBe(true);
    // 広げる方向は不可
    expect(isNarrowerOrEqual(roles("admin", "pm", "member"), roles("admin", "pm"))).toBe(false);
    expect(isNarrowerOrEqual(all, roles("pm"))).toBe(false);
    // 保守的に member_limited は拒否（各メンバーのロールを検証できないため）
    expect(isNarrowerOrEqual(members("u1"), roles("pm"))).toBe(false);
  });

  it("親 member_limited は部分集合の member_limited のみ", () => {
    expect(isNarrowerOrEqual(members("u1"), members("u1", "u2"))).toBe(true);
    expect(isNarrowerOrEqual(members("u1", "u3"), members("u1", "u2"))).toBe(false);
    expect(isNarrowerOrEqual(all, members("u1"))).toBe(false);
    expect(isNarrowerOrEqual(roles("pm"), members("u1"))).toBe(false);
  });
});

describe("UI ヘルパーは isNarrowerOrEqual と整合する", () => {
  it("allowedChildModes が示すモードだけが妥当になりうる", () => {
    expect(allowedChildModes(all)).toEqual(["all", "role_limited", "member_limited"]);
    expect(allowedChildModes(roles("pm"))).toEqual(["role_limited"]);
    expect(allowedChildModes(members("u1"))).toEqual(["member_limited"]);
    // 親なし（プロジェクト自身）は全モード
    expect(allowedChildModes(undefined)).toEqual([
      "all",
      "role_limited",
      "member_limited",
    ]);
  });

  it("selectableRoles の範囲内なら必ず narrowing を満たす", () => {
    const parent = roles("admin", "pm");
    const choices = selectableRoles(parent);
    expect(choices).toEqual(["admin", "pm"]);
    expect(isNarrowerOrEqual({ mode: "role_limited", roles: choices }, parent)).toBe(true);
  });

  it("selectableMemberUids の範囲内なら必ず narrowing を満たす", () => {
    const parent = members("u1", "u2");
    const choices = selectableMemberUids(parent);
    expect(choices).toEqual(["u1", "u2"]);
    expect(
      isNarrowerOrEqual({ mode: "member_limited", memberUids: choices! }, parent),
    ).toBe(true);
    // 親なしは「制限なし」
    expect(selectableMemberUids(undefined)).toBeNull();
  });
});

describe("validateNarrowing のメッセージ", () => {
  it("妥当なら null", () => {
    expect(validateNarrowing(roles("pm"), roles("admin", "pm"))).toBeNull();
    expect(validateNarrowing(all, undefined)).toBeNull();
  });

  it("role_limited 親 + member_limited 子は担当者を案内する", () => {
    const msg = validateNarrowing(members("u1"), roles("pm"));
    expect(msg).toContain("担当者");
  });

  it("その他の広げる設定は汎用メッセージ", () => {
    const msg = validateNarrowing(all, roles("pm"));
    expect(msg).toContain("狭い範囲");
  });
});
