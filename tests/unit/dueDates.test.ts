import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";

import {
  BUSINESS_TIME_ZONE,
  DUE_SOON_WINDOW_DAYS as FN_WINDOW,
  REMINDER_DAY_OFFSETS as FN_OFFSETS,
  calendarDaysBetween,
  isReminderDay,
  reminderQueryRange,
} from "../../functions/src/shared/dueDates";
import {
  DUE_SOON_WINDOW_DAYS as APP_WINDOW,
  REMINDER_DAY_OFFSETS as APP_OFFSETS,
  isReminderTarget,
} from "@/lib/tasks/filters";
import type { Task } from "@/types";

/**
 * アプリ側（lib/tasks/filters.ts）と Cloud Functions 側
 * （functions/src/shared/dueDates.ts）は、実行環境が違うため実装が分かれている
 * （ブラウザはローカル時刻、Functions は JST を明示）。
 * 定義がずれると「画面には出るのに通知が来ない」といった不整合になるため、
 * 定数と判定結果が一致することをここで固定する。
 * テストの TZ は vitest.config.ts で Asia/Tokyo に固定している。
 */

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
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...over,
  };
}

describe("アプリ側と Functions 側の定義が一致している", () => {
  it("テスト実行時のタイムゾーンが JST", () => {
    expect(process.env.TZ).toBe(BUSINESS_TIME_ZONE);
  });

  it("ウィンドウ日数が一致", () => {
    expect(APP_WINDOW).toBe(FN_WINDOW);
  });

  it("リマインド対象のオフセットが一致（当日と2日前のみ・1日前は含まない）", () => {
    expect([...APP_OFFSETS]).toEqual([...FN_OFFSETS]);
    expect([...FN_OFFSETS]).toEqual([0, 2]);
    expect(FN_OFFSETS).not.toContain(1);
  });

  it("同じ期日に対して両者の判定が一致する（-3〜+5日）", () => {
    // 基準: 2026-09-01 09:00 JST（スケジュール実行時刻に相当）
    const from = new Date("2026-09-01T09:00:00+09:00");
    for (let offset = -3; offset <= 5; offset++) {
      const due = new Date("2026-09-01T15:00:00+09:00");
      due.setDate(due.getDate() + offset);

      const fromFunctions = isReminderDay(due, from);
      const fromApp = isReminderTarget(
        task({ dueAt: Timestamp.fromDate(due) }),
        from,
      );
      expect(fromApp, `offset=${offset}`).toBe(fromFunctions);
    }
  });
});

describe("Functions 側の JST カレンダー日計算", () => {
  // 2026-09-01 09:00 JST
  const from = new Date("2026-09-01T00:00:00Z");

  it("当日は時刻によらず 0 日", () => {
    // JST の同じ暦日であれば、基準時刻より前でも後でも 0。
    expect(calendarDaysBetween(from, new Date("2026-08-31T15:30:00Z"))).toBe(0); // 09/01 00:30 JST
    expect(calendarDaysBetween(from, new Date("2026-09-01T14:00:00Z"))).toBe(0); // 09/01 23:00 JST
  });

  it("2日後は 2、1日後は 1、3日後は 3", () => {
    expect(calendarDaysBetween(from, new Date("2026-09-02T03:00:00Z"))).toBe(1);
    expect(calendarDaysBetween(from, new Date("2026-09-03T00:00:00Z"))).toBe(2);
    expect(calendarDaysBetween(from, new Date("2026-09-04T03:00:00Z"))).toBe(3);
  });

  it("リマインド対象は当日と2日後のみ", () => {
    expect(isReminderDay(new Date("2026-09-01T14:00:00Z"), from)).toBe(true);
    expect(isReminderDay(new Date("2026-09-02T03:00:00Z"), from)).toBe(false);
    expect(isReminderDay(new Date("2026-09-03T14:59:00Z"), from)).toBe(true);
    expect(isReminderDay(new Date("2026-09-04T03:00:00Z"), from)).toBe(false);
    expect(isReminderDay(new Date("2026-08-31T03:00:00Z"), from)).toBe(false);
  });

  it("クエリ範囲が JST の当日0:00〜2日後23:59:59.999 を覆う", () => {
    const { start, end } = reminderQueryRange(from);
    expect(start.toISOString()).toBe("2026-08-31T15:00:00.000Z"); // 09/01 00:00 JST
    expect(end.toISOString()).toBe("2026-09-03T14:59:59.999Z"); // 09/03 23:59:59.999 JST

    // 対象になりうる期日がすべて範囲内に入ること
    for (const iso of [
      "2026-08-31T15:00:00Z", // 09/01 00:00 JST
      "2026-09-01T14:00:00Z", // 09/01 23:00 JST
      "2026-09-03T00:00:00Z", // 09/03 09:00 JST
      "2026-09-03T14:59:00Z", // 09/03 23:59 JST
    ]) {
      const d = new Date(iso);
      expect(d >= start && d <= end, iso).toBe(true);
    }
  });
});
