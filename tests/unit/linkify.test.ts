import { describe, expect, it } from "vitest";

import { splitByUrls } from "@/lib/text/linkify";

const urlsOf = (text: string) =>
  splitByUrls(text)
    .filter((s) => s.type === "url")
    .map((s) => s.value);

const joined = (text: string) =>
  splitByUrls(text)
    .map((s) => s.value)
    .join("");

describe("splitByUrls: URL の検出", () => {
  it("http / https の URL を検出する", () => {
    expect(urlsOf("見て http://example.com と https://example.com/a?b=1#c を")).toEqual([
      "http://example.com",
      "https://example.com/a?b=1#c",
    ]);
  });

  it("URL がなければテキスト 1 セグメント", () => {
    expect(splitByUrls("ただのテキストです。")).toEqual([
      { type: "text", value: "ただのテキストです。" },
    ]);
  });

  it("ftp: や www. だけ、javascript: はリンク化しない", () => {
    expect(urlsOf("ftp://x.com www.example.com javascript:alert(1)")).toEqual([]);
  });

  it("分割してもテキスト全体は失われない（結合すると元に戻る）", () => {
    const samples = [
      "冒頭 https://a.example/x 中間 http://b.example 末尾",
      "https://a.example/しかない",
      "改行を\nはさんで https://a.example/x\n次の行",
      "括弧（https://ja.wikipedia.org/wiki/例_(曖昧さ回避)）で終わる",
    ];
    for (const s of samples) expect(joined(s)).toBe(s);
  });
});

describe("splitByUrls: 末尾の約物の扱い", () => {
  it("文末の句読点はリンクに含めない", () => {
    expect(urlsOf("こちら https://example.com/page。")).toEqual([
      "https://example.com/page",
    ]);
    expect(urlsOf("See https://example.com/page.")).toEqual([
      "https://example.com/page",
    ]);
  });

  it("閉じ括弧はリンクに含めない（括弧書きの中の URL）", () => {
    expect(urlsOf("（詳細は https://example.com/doc）")).toEqual([
      "https://example.com/doc",
    ]);
    expect(urlsOf("(see https://example.com/doc)")).toEqual([
      "https://example.com/doc",
    ]);
  });

  it("URL 内で開いた括弧に対応する閉じ括弧はリンクに含める（Wikipedia 形式）", () => {
    expect(urlsOf("https://ja.wikipedia.org/wiki/例_(曖昧さ回避)")).toEqual([
      "https://ja.wikipedia.org/wiki/例_(曖昧さ回避)",
    ]);
  });

  it("クエリ・アンカー・ポート付き URL を壊さない", () => {
    expect(
      urlsOf("https://example.com:8080/path/to?query=a&b=c#section-1 です"),
    ).toEqual(["https://example.com:8080/path/to?query=a&b=c#section-1"]);
  });
});

describe("splitByUrls: XSS になりうる入力", () => {
  it("HTML タグはテキストとして扱われる（URL 以外にリンクは生えない）", () => {
    const text = '<img src=x onerror=alert(1)> と <a href="javascript:alert(1)">x</a>';
    const segments = splitByUrls(text);
    expect(segments.every((s) => s.type === "text")).toBe(true);
    expect(joined(text)).toBe(text);
  });

  it("URL セグメントは必ず http(s) スキームで始まる", () => {
    const text = "https://ok.example と data:text/html,x と vbscript:x";
    for (const u of urlsOf(text)) {
      expect(u.startsWith("http://") || u.startsWith("https://")).toBe(true);
    }
  });

  it("引用符は URL に含めない（属性への突き抜け対策の一環）", () => {
    expect(urlsOf('"https://example.com/x" と \'https://example.com/y\'')).toEqual([
      "https://example.com/x",
      "https://example.com/y",
    ]);
  });
});
