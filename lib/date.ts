import { Timestamp } from "firebase/firestore";

/** Timestamp → `<input type="datetime-local">` の value（ローカル時刻）。 */
export function toDateTimeLocalValue(ts: Timestamp | null | undefined): string {
  if (!ts) return "";
  const d = ts.toDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** `<input type="datetime-local">` の value → Timestamp。空文字は null。 */
export function fromDateTimeLocalValue(value: string): Timestamp | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Timestamp.fromDate(d);
}

/** 表示用の日時フォーマット（例: 2026/09/01 18:30）。 */
export function formatDateTime(ts: Timestamp | null | undefined): string {
  if (!ts) return "—";
  const d = ts.toDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** 日付だけの表示（例: 2026/09/01）。 */
export function formatDate(ts: Timestamp | null | undefined): string {
  if (!ts) return "—";
  const d = ts.toDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/** カレンダー日基準での日数差（相手 - 今日）。期日間近判定に使う。 */
export function daysUntil(ts: Timestamp | null | undefined, from = new Date()): number | null {
  if (!ts) return null;
  const target = ts.toDate();
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
