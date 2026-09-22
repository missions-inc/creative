import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";

import {
  DUE_SOON_WINDOW_DAYS,
  byDueThenPriority,
  isAssignedTo,
  isDueSoon,
  isDueToday,
  isIncomplete,
  isOverdue,
} from "@/lib/tasks/filters";
import type { Task } from "@/types";

/** 基準日時: 2026-09-01 10:00（ローカル） */
const FROM = new Date(2026, 8, 1, 10, 0, 0);

function task(over: Partial<Task> = {}): Task {
  return {
    id: "t1",
    projectId: "p1",
    clientId: "c1",
    title: "task",
    description: "",
    assignees: [],
    dueAt: null,
    status: "not_started",
    priority: "mid",
    visibility: { mode: "all" },
    createdBy: "u1",
    isDeleted: false,
    createdAt: Timestamp.fromDate(FROM),
    updatedAt: Timestamp.fromDate(FROM),
    ...over,
  };
}

const due = (y: number, m: number, d: number, h = 12) =>
  Timestamp.fromDate(new Date(y, m - 1, d, h));

describe("期日間近の判定（カレンダー日基準）", () => {
  it("ウィンドウは 2 日（仕様 §3.10 と一致）", () => {
    expect(DUE_SOON_WINDOW_DAYS).toBe(2);
  });

  it("当日は期日間近（基準より前の時刻でも当日中は対象）", () => {
    // 09:00 は基準の 10:00 より前だが、カレンダー日は同日なので対象。
    expect(isDueSoon(task({ dueAt: due(2026, 9, 1, 9) }), FROM)).toBe(true);
    expect(isDueSoon(task({ dueAt: due(2026, 9, 1, 23) }), FROM)).toBe(true);
  });

  it("1日後・2日後は期日間近", () => {
    expect(isDueSoon(task({ dueAt: due(2026, 9, 2) }), FROM)).toBe(true);
    expect(isDueSoon(task({ dueAt: due(2026, 9, 3) }), FROM)).toBe(true);
  });

  it("3日後は対象外", () => {
    expect(isDueSoon(task({ dueAt: due(2026, 9, 4) }), FROM)).toBe(false);
  });

  it("期日超過は期日間近ではなく overdue", () => {
    const t = task({ dueAt: due(2026, 8, 31, 23) });
    expect(isDueSoon(t, FROM)).toBe(false);
    expect(isOverdue(t, FROM)).toBe(true);
  });

  it("完了済みは期日間近にも超過にも含めない", () => {
    const t = task({ dueAt: due(2026, 9, 1), status: "done" });
    expect(isDueSoon(t, FROM)).toBe(false);
    expect(isOverdue(task({ dueAt: due(2026, 8, 1), status: "done" }), FROM)).toBe(false);
  });

  it("削除済みは含めない", () => {
    const t = task({ dueAt: due(2026, 9, 1), isDeleted: true });
    expect(isDueSoon(t, FROM)).toBe(false);
    expect(isIncomplete(t)).toBe(false);
  });

  it("期日なしは含めない", () => {
    expect(isDueSoon(task({ dueAt: null }), FROM)).toBe(false);
    expect(isOverdue(task({ dueAt: null }), FROM)).toBe(false);
  });
});

describe("本日期日の判定（isDueToday）", () => {
  it("同じカレンダー日なら時刻によらず true", () => {
    expect(isDueToday(task({ dueAt: due(2026, 9, 1, 0) }), FROM)).toBe(true);
    expect(isDueToday(task({ dueAt: due(2026, 9, 1, 9) }), FROM)).toBe(true);
    expect(isDueToday(task({ dueAt: due(2026, 9, 1, 23) }), FROM)).toBe(true);
  });

  it("前日・翌日は false（期日超過 / 1日後は別分類）", () => {
    expect(isDueToday(task({ dueAt: due(2026, 8, 31, 23) }), FROM)).toBe(false);
    expect(isDueToday(task({ dueAt: due(2026, 9, 2) }), FROM)).toBe(false);
  });

  it("完了・削除済み・期日なしは false", () => {
    expect(isDueToday(task({ dueAt: due(2026, 9, 1), status: "done" }), FROM)).toBe(false);
    expect(isDueToday(task({ dueAt: due(2026, 9, 1), isDeleted: true }), FROM)).toBe(false);
    expect(isDueToday(task({ dueAt: null }), FROM)).toBe(false);
  });
});

describe("マイタスク", () => {
  it("assignees に含まれていれば true", () => {
    expect(isAssignedTo(task({ assignees: ["me", "other"] }), "me")).toBe(true);
    expect(isAssignedTo(task({ assignees: ["other"] }), "me")).toBe(false);
  });
});

describe("統一並び順 byDueThenPriority（期日昇順 → 優先度 高→中→低）", () => {
  it("第1キーは期日の昇順（優先度より優先される）", () => {
    const early = task({ id: "a", dueAt: due(2026, 9, 1), priority: "low" });
    const late = task({ id: "b", dueAt: due(2026, 9, 5), priority: "high" });
    expect([late, early].sort(byDueThenPriority).map((t) => t.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("期日なしは末尾（期日ありが優先度によらず先）", () => {
    const noDue = task({ id: "a", dueAt: null, priority: "high" });
    const withDue = task({ id: "b", dueAt: due(2026, 12, 31), priority: "low" });
    expect([noDue, withDue].sort(byDueThenPriority).map((t) => t.id)).toEqual([
      "b",
      "a",
    ]);
  });

  it("期日が同じなら優先度 高→中→低", () => {
    const d = due(2026, 9, 3);
    const mid = task({ id: "m", dueAt: d, priority: "mid" });
    const high = task({ id: "h", dueAt: d, priority: "high" });
    const low = task({ id: "l", dueAt: d, priority: "low" });
    expect([mid, low, high].sort(byDueThenPriority).map((t) => t.id)).toEqual([
      "h",
      "m",
      "l",
    ]);
  });

  it("同じ日なら時刻が遅くても優先度が優先（カレンダー日基準）", () => {
    const early = task({ id: "e", dueAt: due(2026, 9, 3, 9), priority: "low" });
    const late = task({ id: "l", dueAt: due(2026, 9, 3, 18), priority: "high" });
    expect([early, late].sort(byDueThenPriority).map((t) => t.id)).toEqual([
      "l",
      "e",
    ]);
  });

  it("同じ日・同じ優先度なら時刻が早い順", () => {
    const later = task({ id: "b", dueAt: due(2026, 9, 3, 18) });
    const earlier = task({ id: "a", dueAt: due(2026, 9, 3, 9) });
    expect([later, earlier].sort(byDueThenPriority).map((t) => t.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("期日なし同士も優先度 高→中→低", () => {
    const mid = task({ id: "m", dueAt: null, priority: "mid" });
    const high = task({ id: "h", dueAt: null, priority: "high" });
    const low = task({ id: "l", dueAt: null, priority: "low" });
    expect([low, mid, high].sort(byDueThenPriority).map((t) => t.id)).toEqual([
      "h",
      "m",
      "l",
    ]);
  });

  it("期日・優先度とも同じならタイトル順（表示の安定用）", () => {
    const d = due(2026, 9, 3);
    const b = task({ id: "b", title: "b", dueAt: d });
    const a = task({ id: "a", title: "a", dueAt: d });
    expect([b, a].sort(byDueThenPriority).map((t) => t.id)).toEqual(["a", "b"]);
  });
});
