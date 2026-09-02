"use client";

import { useMemo } from "react";

import { splitByUrls } from "@/lib/text/linkify";
import { cn } from "@/lib/utils";

/**
 * URL を自動リンク化してテキストを表示する。
 *
 * XSS 対策: HTML を組み立てず React のテキストノードとして描画するため、
 * URL 以外の内容（タグ等）はすべて自動的にエスケープされる。
 * href は https?:// で始まることが検証済みの文字列のみ。
 */
export function LinkifiedText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const segments = useMemo(() => splitByUrls(text), [text]);

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {segments.map((seg, i) =>
        seg.type === "url" ? (
          <a
            key={i}
            href={seg.value}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-blue-600 underline underline-offset-2 hover:opacity-70"
          >
            {seg.value}
          </a>
        ) : (
          <span key={i}>{seg.value}</span>
        ),
      )}
    </span>
  );
}
