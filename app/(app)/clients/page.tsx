"use client";

import { useState } from "react";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { useClients } from "@/hooks/useCollections";
import {
  createClient,
  setClientDeleted,
  updateClient,
} from "@/lib/firebase/mutations";
import type { Client } from "@/types";

export default function ClientsPage() {
  // クライアント管理は admin のみ（§3.2）。
  return (
    <RequireAuth allowedRoles={["admin"]}>
      <ClientsView />
    </RequireAuth>
  );
}

function ClientsView() {
  const { data: clients, loading, error } = useClients(true);
  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">クライアント</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            クライアントの登録・編集ができます（管理者のみ）。
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus />
          新規クライアント
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          読み込みに失敗しました: {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : clients.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <Card key={c.id} className={c.isDeleted ? "opacity-60" : undefined}>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{c.name}</p>
                    {c.isDeleted ? (
                      <Badge variant="secondary">削除済み</Badge>
                    ) : null}
                  </div>
                  {c.note ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {c.note}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(c)}
                  >
                    <Pencil />
                    編集
                  </Button>
                  <Button
                    variant={c.isDeleted ? "outline" : "destructive"}
                    size="sm"
                    onClick={() => setClientDeleted(c.id, !c.isDeleted)}
                  >
                    {c.isDeleted ? <RotateCcw /> : <Trash2 />}
                    {c.isDeleted ? "復元" : "削除"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ClientDialog
        open={creating}
        onOpenChange={setCreating}
        title="新規クライアント"
        onSubmit={async (v) => {
          await createClient(v);
        }}
      />
      <ClientDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title="クライアントを編集"
        initial={editing ?? undefined}
        onSubmit={async (v) => {
          if (editing) await updateClient(editing.id, v);
          setEditing(null);
        }}
      />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-lg border border-dashed py-16 text-center">
      <p className="text-sm text-muted-foreground">
        まだクライアントが登録されていません。
      </p>
      <Button className="mt-4" onClick={onCreate}>
        <Plus />
        最初のクライアントを登録
      </Button>
    </div>
  );
}

function ClientDialog({
  open,
  onOpenChange,
  title,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initial?: Client;
  onSubmit: (values: { name: string; note?: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ダイアログを開くたびに初期値へリセットする。
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setName(initial?.name ?? "");
      setNote(initial?.note ?? "");
      setError(null);
    }
  }

  const submit = async () => {
    if (!name.trim()) {
      setError("クライアント名を入力してください。");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name, note });
      onOpenChange(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "保存に失敗しました。権限をご確認ください。",
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
            <Label htmlFor="client-name">クライアント名</Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="株式会社〇〇"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-note">メモ</Label>
            <Textarea
              id="client-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="任意"
            />
          </div>
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
