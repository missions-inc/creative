import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENTS_PER_TASK,
  MAX_ATTACHMENT_SIZE_BYTES,
  attachmentStoragePath,
  formatFileSize,
  sanitizeFileName,
  validateAttachmentFile,
} from "@/lib/attachments/constraints";

const file = (over: Partial<{ name: string; size: number; type: string }> = {}) => ({
  name: "a.png",
  size: 1024,
  type: "image/png",
  ...over,
});

describe("添付ファイルの検証（§3.6）", () => {
  it("許可形式・サイズ内・件数内なら OK", () => {
    expect(validateAttachmentFile(file(), 0)).toBeNull();
  });

  it("10MB ちょうどは許可、超過は拒否", () => {
    expect(validateAttachmentFile(file({ size: MAX_ATTACHMENT_SIZE_BYTES }), 0)).toBeNull();
    expect(
      validateAttachmentFile(file({ size: MAX_ATTACHMENT_SIZE_BYTES + 1 }), 0),
    ).toContain("ファイルサイズ");
  });

  it("空ファイルは拒否", () => {
    expect(validateAttachmentFile(file({ size: 0 }), 0)).toContain("空のファイル");
  });

  it("許可外の形式は拒否", () => {
    expect(
      validateAttachmentFile(file({ type: "application/x-msdownload" }), 0),
    ).toContain("この形式は");
  });

  it("1タスク10ファイルが上限", () => {
    expect(validateAttachmentFile(file(), MAX_ATTACHMENTS_PER_TASK - 1)).toBeNull();
    expect(validateAttachmentFile(file(), MAX_ATTACHMENTS_PER_TASK)).toContain(
      "最大 10 ファイル",
    );
  });
});

describe("Storage パスの組み立て", () => {
  it("storage.rules の match と同じ 4 セグメント構成になる", () => {
    const path = attachmentStoragePath("task1", "att1", "report.pdf");
    expect(path).toBe("task-attachments/task1/att1/report.pdf");
    expect(path.split("/")).toHaveLength(4);
  });

  it("パス区切り文字を含むファイル名を無害化する", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(attachmentStoragePath("t", "a", "a/b.png").split("/")).toHaveLength(4);
  });
});

describe("formatFileSize", () => {
  it("単位を切り替える", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(10 * 1024 * 1024)).toBe("10.0 MB");
  });
});

// ---------------------------------------------------------------------------
// 許可 MIME タイプは TS / firestore.rules / storage.rules の 3 箇所にある。
// ずれると「クライアントは通すがルールが拒否する」等の不整合になるため、
// 一致していることをテストで固定する。
// ---------------------------------------------------------------------------
function mimeListFromRules(filePath: string, fnName: string): string[] {
  const src = readFileSync(resolve(process.cwd(), filePath), "utf8");
  const fnStart = src.indexOf(`function ${fnName}(`);
  if (fnStart === -1) throw new Error(`${fnName} が ${filePath} に見つかりません`);
  const open = src.indexOf("[", fnStart);
  const close = src.indexOf("]", open);
  return src
    .slice(open + 1, close)
    .split(",")
    .map((s) => s.trim().replace(/^'|'$/g, ""))
    .filter(Boolean);
}

describe("許可 MIME タイプがルールと一致している", () => {
  const expected = [...ALLOWED_ATTACHMENT_MIME_TYPES].sort();

  it("firestore.rules の isAllowedAttachmentType と一致", () => {
    expect(mimeListFromRules("firestore.rules", "isAllowedAttachmentType").sort()).toEqual(
      expected,
    );
  });

  it("storage.rules の isAllowedType と一致", () => {
    expect(mimeListFromRules("storage.rules", "isAllowedType").sort()).toEqual(expected);
  });

  it("サイズ上限がルールと一致（10 * 1024 * 1024）", () => {
    for (const f of ["firestore.rules", "storage.rules"]) {
      const src = readFileSync(resolve(process.cwd(), f), "utf8");
      expect(src).toContain("10 * 1024 * 1024");
    }
    expect(MAX_ATTACHMENT_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });
});
