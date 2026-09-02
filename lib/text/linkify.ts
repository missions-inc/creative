/**
 * テキスト中の URL（http:// / https://）を検出して分割する純粋関数。
 *
 * XSS 対策の方針:
 * - HTML 文字列は一切生成しない。ここでは「テキスト or URL」のセグメント列に
 *   分割するだけで、描画は React のテキストノード（自動エスケープ）に任せる
 *   （components/ui/linkified-text.tsx）。dangerouslySetInnerHTML は使わない。
 * - リンクの href になるのは正規表現で https?:// から始まると確認した文字列のみ。
 *   javascript: などのスキームは構造上混入しない。
 */

export type TextSegment =
  | { type: "text"; value: string }
  | { type: "url"; value: string };

// URL 本体: スキーム + 空白/制御文字/引用符/HTML山括弧 以外の連続。
// 末尾の句読点などは後段の trimTrailing で調整する。
const URL_PATTERN = /https?:\/\/[^\s<>"'　]+/g;

// URL の末尾に付きがちな約物（文末の句点・閉じ括弧など）。リンクに含めない。
const TRAILING_CHARS = new Set([
  ".", ",", ";", ":", "!", "?",
  ")", "]", "}",
  "。", "、", "，", "．", "！", "？",
  "）", "」", "』", "】", "〉", "》", "”", "’",
]);

/** 対応する開き括弧（URL 内で開いていれば閉じ括弧を末尾から削らない）。 */
const BRACKET_PAIRS: Record<string, string> = {
  ")": "(",
  "]": "[",
  "}": "{",
  "）": "（",
};

/** URL 末尾の約物を切り離す。返り値は [URL, 切り離した残り]。 */
function trimTrailing(url: string): [string, string] {
  let end = url.length;
  while (end > 0) {
    const ch = url[end - 1];
    if (!TRAILING_CHARS.has(ch)) break;
    // 閉じ括弧は、URL 内に対応する開き括弧が余っていればリンクの一部とみなす
    // （例: Wikipedia の "...(foo)" で終わる URL）。
    const open = BRACKET_PAIRS[ch];
    if (open) {
      const body = url.slice(0, end);
      const opens = body.split(open).length - 1;
      const closes = body.split(ch).length - 1;
      if (opens >= closes) break;
    }
    end -= 1;
  }
  return [url.slice(0, end), url.slice(end)];
}

/** テキストを「通常テキスト」と「URL」のセグメント列に分割する。 */
export function splitByUrls(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const [url, rest] = trimTrailing(raw);
    if (url.length <= "https://".length) continue; // スキームだけの残骸は無視

    if (start > cursor) {
      segments.push({ type: "text", value: text.slice(cursor, start) });
    }
    segments.push({ type: "url", value: url });
    if (rest) segments.push({ type: "text", value: rest });
    cursor = start + raw.length;
  }

  if (cursor < text.length) {
    segments.push({ type: "text", value: text.slice(cursor) });
  }
  return segments;
}
