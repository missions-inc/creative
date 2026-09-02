import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";

import {
  DUE_SOON_WINDOW_DAYS,
  isAssignedTo,
  isDueSoon,
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

describe("マイタスク", () => {
  it("assignees に含まれていれば true", () => {
    expect(isAssignedTo(task({ assignees: ["me", "other"] }), "me")).toBe(true);
    expect(isAssignedTo(task({ assignees: ["other"] }), "me")).toBe(false);
  });
});
