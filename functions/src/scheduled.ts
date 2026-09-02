/**
 * 期日リマインド（仕様書 §3.10 トリガー 3）。
 *
 * 毎朝 9:00（JST）に実行し、期日が「2 日前」または「当日」の
 * **未完了**タスクの担当者へ通知する。
 * 判定は shared/dueDates.ts（カレンダー日基準・JST）に集約している。
 */
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";

import { notifyUsers } from "./notifications";
import {
  BUSINESS_TIME_ZONE,
  calendarDaysBetween,
  isReminderDay,
  reminderQueryRange,
} from "./shared/dueDates";

export const dailyDueReminder = onSchedule(
  {
    // 毎日 9:00 JST
    schedule: "0 9 * * *",
    timeZone: BUSINESS_TIME_ZONE,
    region: "asia-northeast1",
  },
  async () => {
    const db = getFirestore();
    const now = new Date();

    // 当日 0:00 〜 2日後 23:59:59.999（JST）の範囲を一度に取得し、
    // 「ちょうど 0 日後 / 2 日後」だけをコード側で絞り込む。
    const { start, end } = reminderQueryRange(now);

    const snap = await db
      .collection("tasks")
      .where("dueAt", ">=", Timestamp.fromDate(start))
      .where("dueAt", "<=", Timestamp.fromDate(end))
      .get();

    let notified = 0;
    let targets = 0;

    for (const doc of snap.docs) {
      const data = doc.data() as {
        title?: string;
        assignees?: string[];
        status?: string;
        isDeleted?: boolean;
        dueAt?: Timestamp;
      };

      if (data.isDeleted) continue;
      if (data.status === "done") continue; // 未完了のみ
      const dueAt = data.dueAt?.toDate();
      if (!dueAt || !isReminderDay(dueAt, now)) continue;

      const assignees = data.assignees ?? [];
      if (assignees.length === 0) continue;

      targets += 1;
      const days = calendarDaysBetween(now, dueAt);
      const when = days === 0 ? "本日" : `${days}日後`;

      notified += await notifyUsers({
        toUids: assignees,
        type: "reminder",
        taskId: doc.id,
        title: `期日${when}のタスクがあります`,
        body: data.title ?? "(無題のタスク)",
      });
    }

    logger.info("期日リマインドを実行", {
      scanned: snap.size,
      targets,
      pushed: notified,
      rangeStart: start.toISOString(),
      rangeEnd: end.toISOString(),
    });
  },
);
