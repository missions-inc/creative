/**
 * 毎朝 9:00（JST）のバッチ。
 *
 * 1. 期日リマインド（プッシュ / 仕様書 §3.10 トリガー 3）:
 *    期日が「2 日前」または「当日」の未完了タスクの担当者へ Web Push を送る。
 *
 * 2. デイリーダイジェスト（メール）:
 *    担当者ごとに 1 通。未完了タスクを「期日超過／本日期日／2日以内」にまとめて
 *    Gmail SMTP で送る。対象がゼロの人には送らない。
 *
 * 判定は shared/dueDates.ts（カレンダー日基準・JST）に集約している。
 */
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";

import { notifyUsers } from "./notifications";
import {
  gmailSmtpPassword,
  isEmptyDigest,
  sendDailyDigests,
  type Digest,
  type DigestTask,
} from "./email";
import {
  BUSINESS_TIME_ZONE,
  calendarDaysBetween,
  DUE_SOON_WINDOW_DAYS,
  isReminderDay,
  reminderQueryRange,
} from "./shared/dueDates";

interface TaskDoc {
  title?: string;
  assignees?: string[];
  status?: string;
  isDeleted?: boolean;
  dueAt?: Timestamp;
  priority?: string;
  clientId?: string;
  projectId?: string;
}

export const dailyDueReminder = onSchedule(
  {
    // 毎日 9:00 JST
    schedule: "0 9 * * *",
    timeZone: BUSINESS_TIME_ZONE,
    region: "asia-northeast1",
    timeoutSeconds: 300,
    secrets: [gmailSmtpPassword],
  },
  async () => {
    const db = getFirestore();
    const now = new Date();

    // 期日が「2日後の終わり（JST）」までのタスクを一度に取得する。
    // 下限は設けない = 期日超過分も含める（ダイジェストの「期日超過」に使う）。
    // dueAt が null のタスクは範囲クエリに一致しないため自然に除外される。
    const { end } = reminderQueryRange(now);
    const snap = await db
      .collection("tasks")
      .where("dueAt", "<=", Timestamp.fromDate(end))
      .get();

    // --- 未完了タスクだけを抽出 ---
    const incomplete = snap.docs
      .map((doc) => ({ id: doc.id, data: doc.data() as TaskDoc }))
      .filter(({ data }) => !data.isDeleted && data.status !== "done" && data.dueAt);

    // --- 1. プッシュリマインド（当日・2日前ちょうどのみ）---
    let pushed = 0;
    let pushTargets = 0;
    for (const { id, data } of incomplete) {
      const dueAt = data.dueAt!.toDate();
      if (!isReminderDay(dueAt, now)) continue;
      const assignees = data.assignees ?? [];
      if (assignees.length === 0) continue;

      pushTargets += 1;
      const days = calendarDaysBetween(now, dueAt);
      const when = days === 0 ? "本日" : `${days}日後`;
      pushed += await notifyUsers({
        toUids: assignees,
        type: "reminder",
        taskId: id,
        title: `期日${when}のタスクがあります`,
        body: data.title ?? "(無題のタスク)",
      });
    }

    // --- 2. メールダイジェスト（担当者ごとに 1 通）---
    // 参照するクライアント／プロジェクト名を一括で取得する。
    const clientIds = new Set<string>();
    const projectIds = new Set<string>();
    for (const { data } of incomplete) {
      if (data.clientId) clientIds.add(data.clientId);
      if (data.projectId) projectIds.add(data.projectId);
    }
    const nameOf = async (col: string, ids: Set<string>) => {
      const map = new Map<string, string>();
      if (ids.size === 0) return map;
      const refs = Array.from(ids).map((id) => db.collection(col).doc(id));
      const docs = await db.getAll(...refs);
      for (const d of docs) map.set(d.id, (d.get("name") as string) ?? "—");
      return map;
    };
    const [clientNames, projectNames] = await Promise.all([
      nameOf("clients", clientIds),
      nameOf("projects", projectIds),
    ]);

    // 担当者 UID ごとにタスクを振り分ける。
    const digestByUid = new Map<string, Digest>();
    for (const { id, data } of incomplete) {
      const dueAt = data.dueAt!.toDate();
      const days = calendarDaysBetween(now, dueAt);
      // 3日以上先はダイジェスト対象外。
      if (days > DUE_SOON_WINDOW_DAYS) continue;

      const entry: DigestTask = {
        id,
        title: data.title ?? "(無題のタスク)",
        dueAt,
        priority: data.priority ?? "mid",
        clientName: clientNames.get(data.clientId ?? "") ?? "—",
        projectName: projectNames.get(data.projectId ?? "") ?? "—",
      };

      for (const uid of data.assignees ?? []) {
        const digest =
          digestByUid.get(uid) ?? { overdue: [], today: [], upcoming: [] };
        if (days < 0) digest.overdue.push(entry);
        else if (days === 0) digest.today.push(entry);
        else digest.upcoming.push(entry);
        digestByUid.set(uid, digest);
      }
    }

    // UID → メールアドレスを解決し、宛先別ダイジェストにする。
    const digestByEmail = new Map<string, Digest>();
    if (digestByUid.size > 0) {
      const userRefs = Array.from(digestByUid.keys()).map((uid) =>
        db.collection("users").doc(uid),
      );
      const userDocs = await db.getAll(...userRefs);
      for (const userDoc of userDocs) {
        const digest = digestByUid.get(userDoc.id);
        const email = userDoc.get("email") as string | undefined;
        if (!digest || isEmptyDigest(digest) || !email) continue;
        // 各セクションを期日昇順に整える。
        const byDue = (a: DigestTask, b: DigestTask) =>
          a.dueAt.getTime() - b.dueAt.getTime();
        digest.overdue.sort(byDue);
        digest.today.sort(byDue);
        digest.upcoming.sort(byDue);
        digestByEmail.set(email, digest);
      }
    }

    const mailed = await sendDailyDigests(digestByEmail, now);

    logger.info("毎朝バッチを実行", {
      scanned: snap.size,
      incomplete: incomplete.length,
      pushTargets,
      pushed,
      digestRecipients: digestByEmail.size,
      mailed, // -1 = SMTP 未設定でスキップ
    });
  },
);
