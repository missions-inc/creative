"use client";

import { Filter, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { AppUser } from "@/types";

/**
 * 担当者による絞り込み（チェックボックス・複数選択は OR 条件）。
 * 候補は「その時点で表示対象になっているタスクの担当者」に限定して渡すこと。
 * 未選択（全解除）のときは全件表示の意味になる。
 */
export function AssigneeFilter({
  candidates,
  selected,
  onChange,
}: {
  candidates: AppUser[];
  selected: string[];
  onChange: (uids: string[]) => void;
}) {
  if (candidates.length === 0) return null;

  const toggle = (uid: string, checked: boolean) => {
    onChange(checked ? [...selected, uid] : selected.filter((u) => u !== uid));
  };

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          担当者で絞り込み
        </span>

        {candidates.map((u) => (
          <label
            key={u.uid}
            className="flex cursor-pointer items-center gap-1.5 text-sm"
          >
            <Checkbox
              checked={selected.includes(u.uid)}
              onCheckedChange={(c) => toggle(u.uid, c === true)}
            />
            {u.displayName ?? u.email}
          </label>
        ))}

        {selected.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onChange([])}
          >
            <X className="h-3.5 w-3.5" />
            絞り込みを解除
          </Button>
        ) : null}
      </div>
    </div>
  );
}
