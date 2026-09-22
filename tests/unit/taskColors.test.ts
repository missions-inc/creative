import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";

import {
  DUE_BORDER_CLASSES,
  DUE_HEADING_CLASSES,
  DUE_SECTION_LABELS,
  DUE_TEXT_CLASSES,
  DUE_URGENCIES,
  PRIORITY_BADGE_CLASSES,
  STATUS_SELECT_ITEM_CLASSES,
  STATUS_SELECT_TRIGGER_CLASSES,
  dueUrgency,
} from "@/lib/tasks/colors";
import { TASK_PRIORITIES, TASK_STATUSES, type Task } from "@/types";

const FROM = new Date(2026, 8, 9, 10, 0, 0); // 2026-09-09 10:00 JST

function task(over: Partial<Task> = {}): Task {
  return {
    id: "t",
    projectId: "p",
    clientId: "c",
    title: "t",
    description: "",
    assignees: [],
    dueAt: null,
    status: "not_started",
    priority: "mid",
    visibility: { mode: "all" },
    createdBy: "u",
    isDeleted: false,
    createdAt: Timestamp.fromDate(FROM),
    updatedAt: Timestamp.fromDate(FROM),
    ...over,
  };
}
const due = (d: number, m: number) => Timestamp.fromDate(new Date(2026, m - 1, d, 12));

describe("dueUrgency（filters.ts の判定に委譲・4分類）", () => {
  it("超過 / 本日 / 1〜2日 / それ以外", () => {
    expect(dueUrgency(task({ dueAt: due(8, 9) }), FROM)).toBe("overdue");
    expect(dueUrgency(task({ dueAt: due(9, 9) }), FROM)).toBe("due_today"); // 当日
    expect(dueUrgency(task({ dueAt: due(10, 9) }), FROM)).toBe("due_near"); // 1日後
    expect(dueUrgency(task({ dueAt: due(11, 9) }), FROM)).toBe("due_near"); // 2日後
    expect(dueUrgency(task({ dueAt: due(12, 9) }), FROM)).toBe("normal"); // 3日後
    expect(dueUrgency(task({ dueAt: null }), FROM)).toBe("normal");
  });

  it("本日期日は時刻が基準より前でも due_today（カレンダー日基準）", () => {
    const morning = Timestamp.fromDate(new Date(2026, 8, 9, 1));
    expect(dueUrgency(task({ dueAt: morning }), FROM)).toBe("due_today");
  });

  it("完了タスクは期日超過でも normal（緊急度は未完了のみの概念）", () => {
    expect(dueUrgency(task({ dueAt: due(1, 9), status: "done" }), FROM)).toBe("normal");
  });
});

describe("色クラスの定義漏れがない", () => {
  it("全ステータスに Select 用の色（トリガー / 項目）がある", () => {
    for (const s of TASK_STATUSES) {
      expect(STATUS_SELECT_TRIGGER_CLASSES[s], s).toBeTruthy();
      expect(STATUS_SELECT_ITEM_CLASSES[s], s).toBeTruthy();
    }
  });

  it("全優先度にバッジ色がある", () => {
    for (const p of TASK_PRIORITIES) {
      expect(PRIORITY_BADGE_CLASSES[p], p).toBeTruthy();
    }
  });

  it("枠線・テキスト・見出し・ラベルが全4分類ぶん揃っている", () => {
    expect(DUE_URGENCIES).toEqual([
      "overdue",
      "due_today",
      "due_near",
      "normal",
    ]);
    for (const u of DUE_URGENCIES) {
      expect(DUE_BORDER_CLASSES[u], u).toBeDefined();
      expect(DUE_TEXT_CLASSES[u], u).toBeDefined();
      expect(DUE_HEADING_CLASSES[u], u).toBeDefined();
      expect(DUE_SECTION_LABELS[u], u).toBeTruthy();
    }
  });

  it("4分類の枠線は互いに異なる色（本日=黄 / 1〜2日=濃いグレーが見分けられる）", () => {
    const borders = DUE_URGENCIES.map((u) => DUE_BORDER_CLASSES[u]);
    expect(new Set(borders).size).toBe(borders.length);
  });

  it("役割の住み分け: ステータス色は枠線に使わない（枠線クラスに bg- を含めない）", () => {
    for (const cls of Object.values(DUE_BORDER_CLASSES)) {
      expect(cls).not.toMatch(/bg-/);
    }
  });

  it("枠線は通常の太さ（border-2 などの太線を使わない）", () => {
    for (const cls of Object.values(DUE_BORDER_CLASSES)) {
      expect(cls).not.toMatch(/border-\d/);
    }
  });
});
