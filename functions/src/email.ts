/**
 * デイリーダイジェストメール（毎朝 9:00 JST のバッチから呼ばれる）。
 *
 * 担当者ごとに 1 通。未完了タスクを「期日超過／本日期日／2日以内」に分けてまとめる。
 * 対象がゼロの人には送らない。
 *
 * 送信は Gmail SMTP（Nodemailer）。認証情報はコードに置かず、
 *   - GMAIL_SMTP_USER     : 環境変数パラメータ（functions/.env またはデプロイ時に指定）
 *   - GMAIL_SMTP_PASSWORD : Secret Manager（firebase functions:secrets:set で登録）
 * で管理する。未設定の場合はスキップして警告ログのみ残す（プッシュ通知には影響しない）。
 *
 * ※ Gmail は通常のパスワードでは SMTP 認証できない。
 *   2 段階認証を有効にしたうえで「アプリ パスワード」を発行して使うこと。
 */
import { defineSecret, defineString } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as nodemailer from "nodemailer";

export const gmailSmtpUser = defineString("GMAIL_SMTP_USER", { default: "" });
export const gmailSmtpPassword = defineSecret("GMAIL_SMTP_PASSWORD");

const APP_BASE_URL =
  process.env.APP_BASE_URL ?? "https://missions-coorpolate.web.app";

const PRIORITY_LABELS: Record<string, string> = {
  high: "高",
  mid: "中",
  low: "低",
};

export interface DigestTask {
  id: string;
  title: string;
  dueAt: Date;
  priority: string;
  clientName: string;
  projectName: string;
}

export interface Digest {
  overdue: DigestTask[];
  today: DigestTask[];
  upcoming: DigestTask[];
}

export function isEmptyDigest(d: Digest): boolean {
  return d.overdue.length === 0 && d.today.length === 0 && d.upcoming.length === 0;
}

/** SMTP が設定済みなら transporter を返す。未設定なら null。 */
function createTransport(): nodemailer.Transporter | null {
  const user = gmailSmtpUser.value();
  const pass = gmailSmtpPassword.value();
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
}

/**
 * ダイジェストメールを送る。
 * @param digests 宛先メールアドレス → ダイジェスト（空のものは呼び出し側で除外済みでも二重に守る）
 * @returns 送信件数（SMTP 未設定時は -1）
 */
export async function sendDailyDigests(
  digests: Map<string, Digest>,
  today: Date,
): Promise<number> {
  const transport = createTransport();
  if (!transport) {
    logger.warn(
      "GMAIL_SMTP_USER / GMAIL_SMTP_PASSWORD が未設定のため、ダイジェストメールをスキップしました。",
    );
    return -1;
  }

  const dateLabel = today.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });

  let sent = 0;
  for (const [email, digest] of digests) {
    if (isEmptyDigest(digest)) continue; // 対象ゼロの人には送らない。

    const counts = [
      digest.overdue.length > 0 ? `超過${digest.overdue.length}` : null,
      digest.today.length > 0 ? `本日${digest.today.length}` : null,
      digest.upcoming.length > 0 ? `間近${digest.upcoming.length}` : null,
    ]
      .filter(Boolean)
      .join("・");

    try {
      await transport.sendMail({
        from: `タスク管理 <${gmailSmtpUser.value()}>`,
        to: email,
        subject: `【タスク管理】${dateLabel} のタスク状況（${counts}）`,
        text: renderText(digest),
        html: renderHtml(digest),
      });
      sent += 1;
    } catch (e) {
      // 1 通の失敗で全体を止めない。
      logger.error("ダイジェストメールの送信に失敗", { to: email, e });
    }
  }
  return sent;
}

function formatDue(d: Date): string {
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderText(digest: Digest): string {
  const section = (title: string, tasks: DigestTask[]): string => {
    if (tasks.length === 0) return "";
    const lines = tasks.map(
      (t) =>
        `・${t.title}（${t.clientName} ／ ${t.projectName}）\n` +
        `  期日: ${formatDue(t.dueAt)} ／ 優先度: ${PRIORITY_LABELS[t.priority] ?? t.priority}\n` +
        `  ${APP_BASE_URL}/tasks/${t.id}`,
    );
    return `■ ${title}（${tasks.length}件）\n${lines.join("\n")}\n\n`;
  };

  return (
    "おはようございます。本日のタスク状況をお知らせします。\n\n" +
    section("期日超過", digest.overdue) +
    section("本日期日", digest.today) +
    section("期日まで2日以内", digest.upcoming) +
    `ダッシュボード: ${APP_BASE_URL}/dashboard\n` +
    "―― このメールはタスク管理アプリから自動送信されています。"
  );
}

function renderHtml(digest: Digest): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const section = (title: string, color: string, tasks: DigestTask[]): string => {
    if (tasks.length === 0) return "";
    const rows = tasks
      .map(
        (t) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">
            <a href="${APP_BASE_URL}/tasks/${t.id}" style="color:#0f172a;font-weight:600;text-decoration:none;">${esc(t.title)}</a>
            <div style="color:#64748b;font-size:12px;margin-top:2px;">
              ${esc(t.clientName)} ／ ${esc(t.projectName)}
            </div>
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;white-space:nowrap;color:${color};font-size:13px;">
            ${formatDue(t.dueAt)}
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;white-space:nowrap;font-size:13px;">
            ${esc(PRIORITY_LABELS[t.priority] ?? t.priority)}
          </td>
        </tr>`,
      )
      .join("");
    return `
      <h3 style="margin:20px 0 8px;color:${color};font-size:15px;">${title}（${tasks.length}件）</h3>
      <table style="border-collapse:collapse;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;">
        <tr style="color:#64748b;font-size:12px;text-align:left;">
          <th style="padding:6px 12px;">タスク</th>
          <th style="padding:6px 12px;">期日</th>
          <th style="padding:6px 12px;">優先度</th>
        </tr>
        ${rows}
      </table>`;
  };

  return `
  <div style="font-family:-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
    <p>おはようございます。本日のタスク状況をお知らせします。</p>
    ${section("期日超過", "#dc2626", digest.overdue)}
    ${section("本日期日", "#d97706", digest.today)}
    ${section("期日まで2日以内", "#0369a1", digest.upcoming)}
    <p style="margin-top:24px;">
      <a href="${APP_BASE_URL}/dashboard" style="color:#2563eb;">ダッシュボードを開く</a>
    </p>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
      このメールはタスク管理アプリから自動送信されています。
    </p>
  </div>`;
}
