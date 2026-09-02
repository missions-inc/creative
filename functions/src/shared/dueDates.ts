/**
 * =============================================================================
 * 期日リマインドの日付判定（純粋関数・依存なし）
 * -----------------------------------------------------------------------------
 * 仕様書 §3.10: 期日リマインドは毎朝 9:00（JST）に実行し、
 *   期日が「2 日前（カレンダー日基準）」および「当日」の未完了タスクの担当者へ送る。
 *   → 通知対象は「期日までの残り日数」が **0 日（当日）または 2 日** のとき。
 *     1 日前には送らない（仕様どおり）。
 *
 * ⚠️ アプリ側（lib/tasks/filters.ts）にも同じ考え方の判定がある。
 *    ただしダッシュボードの「期日間近」は 0〜2 日の**範囲**を表示するのに対し、
 *    リマインド通知は 0 と 2 の**ちょうど**その日だけを対象とする点が異なる。
 *    両者の定数がずれないよう tests/unit/dueDates.test.ts で突き合わせている。
 *
 * Cloud Functions は UTC で動くため、カレンダー日の計算には必ず
 * タイムゾーン（Asia/Tokyo）を明示すること。
 * =============================================================================
 */

/** ダッシュボードの「期日間近」ウィンドウ（日）。 */
export const DUE_SOON_WINDOW_DAYS = 2;

/** リマインドを送る「期日までの残り日数」。当日(0) と 2日前(2)。 */
export const REMINDER_DAY_OFFSETS: readonly number[] = [0, DUE_SOON_WINDOW_DAYS];

/** 業務上の基準タイムゾーン。 */
export const BUSINESS_TIME_ZONE = "Asia/Tokyo";

/** 指定タイムゾーンにおける年月日を取り出す。 */
function partsInTimeZone(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA は YYYY-MM-DD 形式。
  const [year, month, day] = fmt.format(date).split("-").map(Number);
  return { year, month, day };
}

/**
 * 指定タイムゾーンにおける「通算日番号」。
 * 日付同士の差をとるためだけに使う（絶対値に意味はない）。
 */
export function calendarDayIndex(date: Date, timeZone: string): number {
  const { year, month, day } = partsInTimeZone(date, timeZone);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

/** カレンダー日基準での日数差（to - from）。 */
export function calendarDaysBetween(
  from: Date,
  to: Date,
  timeZone: string = BUSINESS_TIME_ZONE,
): number {
  return calendarDayIndex(to, timeZone) - calendarDayIndex(from, timeZone);
}

/** 期日 dueAt が、基準日 from から見てリマインド対象の日か。 */
export function isReminderDay(
  dueAt: Date,
  from: Date,
  timeZone: string = BUSINESS_TIME_ZONE,
): boolean {
  return REMINDER_DAY_OFFSETS.includes(calendarDaysBetween(from, dueAt, timeZone));
}

/**
 * リマインド対象日の「JST 日付範囲」を UTC の Date で返す。
 * Firestore へ投げる dueAt の範囲クエリに使う（当日 0:00 〜 2日後 23:59:59.999）。
 */
export function reminderQueryRange(
  from: Date,
  timeZone: string = BUSINESS_TIME_ZONE,
): { start: Date; end: Date } {
  const maxOffset = Math.max(...REMINDER_DAY_OFFSETS);
  return {
    start: startOfDayInTimeZone(from, 0, timeZone),
    end: new Date(
      startOfDayInTimeZone(from, maxOffset + 1, timeZone).getTime() - 1,
    ),
  };
}

/**
 * 指定タイムゾーンにおける「from の offsetDays 日後の 0:00」を UTC の Date で返す。
 * タイムゾーンのオフセットを実測して補正するため、DST のある地域でも概ね正しく動く
 * （JST は DST なし）。
 */
export function startOfDayInTimeZone(
  from: Date,
  offsetDays: number,
  timeZone: string = BUSINESS_TIME_ZONE,
): Date {
  const { year, month, day } = partsInTimeZone(from, timeZone);
  // まず「その暦日の 0:00 を UTC とみなした時刻」を作る。
  const asUtc = Date.UTC(year, month - 1, day + offsetDays, 0, 0, 0, 0);
  // その時刻における当該タイムゾーンのオフセットぶんだけ戻す。
  const offsetMs = timeZoneOffsetMs(new Date(asUtc), timeZone);
  return new Date(asUtc - offsetMs);
}

/** 指定時刻における当該タイムゾーンの UTC からのオフセット（ミリ秒）。 */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  );
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? "0" : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asIfUtc - date.getTime();
}
