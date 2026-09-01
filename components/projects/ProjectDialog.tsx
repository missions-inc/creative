"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VisibilityEditor } from "@/components/visibility/VisibilityEditor";
import { isValidVisibility } from "@/lib/access/visibility";
import type { AppUser, Client, Project, Visibility } from "@/types";

export function ProjectDialog({
  open,
  onOpenChange,
  title,
  clients,
  users,
  initial,
  /** 編集時はクライアントを変更できない（ルールでも clientId 不変）。 */
  lockClient,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  clients: Client[];
  users: AppUser[];
  initial?: Project;
  lockClient?: boolean;
  onSubmit: (values: {
    clientId: string;
    name: string;
    visibility: Visibility;
  }) => Promise<void>;
}) {
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<Visibility>({ mode: "all" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setClientId(initial?.clientId ?? "");
      setName(initial?.name ?? "");
      setVisibility(initial?.visibility ?? { mode: "all" });
      setError(null);
    }
  }

  const submit = async () => {
    if (!clientId) return setError("クライアントを選択してください。");
    if (!name.trim()) return setError("プロジェクト名を入力してください。");
    if (!isValidVisibility(visibility))
      return setError("公開範囲の設定が不正です。");

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ clientId, name, visibility });
      onOpenChange(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "保存に失敗しました。権限をご確認ください。",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>クライアント</Label>
            <Select
              value={clientId}
              onValueChange={setClientId}
              disabled={lockClient}
            >
              <SelectTrigger>
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clients.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                先にクライアントを登録してください（管理者のみ）。
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-name">プロジェクト名</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="サイトリニューアル"
            />
          </div>

          {/* プロジェクトは最上位のため親 visibility の制約はない */}
          <VisibilityEditor
            value={visibility}
            onChange={setVisibility}
            users={users}
          />

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Spinner /> : null}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
