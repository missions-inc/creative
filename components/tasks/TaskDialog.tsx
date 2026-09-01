"use client";

import { useState } from "react";
import type { Timestamp } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { VisibilityEditor } from "@/components/visibility/VisibilityEditor";
import { validateNarrowing } from "@/lib/access/visibility";
import { fromDateTimeLocalValue, toDateTimeLocalValue } from "@/lib/date";
import {
  ROLE_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type AppUser,
  type Project,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type Visibility,
} from "@/types";

export interface TaskFormValues {
  title: string;
  description: string;
  assignees: string[];
  dueAt: Timestamp | null;
  status: TaskStatus;
  priority: TaskPriority;
  visibility: Visibility;
}

export function TaskDialog({
  open,
  onOpenChange,
  title,
  project,
  users,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  project: Project;
  users: AppUser[];
  initial?: Task;
  onSubmit: (values: TaskFormValues) => Promise<void>;
}) {
  const [taskTitle, setTaskTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [dueAtValue, setDueAtValue] = useState("");
  const [status, setStatus] = useState<TaskStatus>("not_started");
  const [priority, setPriority] = useState<TaskPriority>("mid");
  // 既定はプロジェクトの visibility を継承（§3.5）。
  const [visibility, setVisibility] = useState<Visibility>({ mode: "all" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setTaskTitle(initial?.title ?? "");
      setDescription(initial?.description ?? "");
      setAssignees(initial?.assignees ?? []);
      setDueAtValue(toDateTimeLocalValue(initial?.dueAt));
      setStatus(initial?.status ?? "not_started");
      setPriority(initial?.priority ?? "mid");
      setVisibility(initial?.visibility ?? project.visibility);
      setError(null);
    }
  }

  const narrowingError = validateNarrowing(visibility, project.visibility);

  const toggleAssignee = (uid: string, checked: boolean) => {
    setAssignees((prev) =>
      checked ? [...prev, uid] : prev.filter((u) => u !== uid),
    );
  };

  const submit = async () => {
    if (!taskTitle.trim()) return setError("タイトルを入力してください。");
    if (narrowingError) return setError(narrowingError);

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title: taskTitle,
        description,
        assignees,
        dueAt: fromDateTimeLocalValue(dueAtValue),
        status,
        priority,
        visibility,
      });
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">タイトル</Label>
            <Input
              id="task-title"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="トップページのデザイン修正"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">詳細</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="任意"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>ステータス</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as TaskStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TASK_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>優先度</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {TASK_PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-due">期日</Label>
              <Input
                id="task-due"
                type="datetime-local"
                value={dueAtValue}
                onChange={(e) => setDueAtValue(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs font-medium text-muted-foreground">
              担当者（複数選択可）
            </p>
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {users.map((u) => (
                <label key={u.uid} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={assignees.includes(u.uid)}
                    onCheckedChange={(c) => toggleAssignee(u.uid, c === true)}
                  />
                  <span>
                    {u.displayName ?? u.email}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({ROLE_LABELS[u.role]})
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 親（プロジェクト）の範囲内でのみ設定可（境界ルール2） */}
          <VisibilityEditor
            value={visibility}
            onChange={setVisibility}
            parent={project.visibility}
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
          <Button
            onClick={submit}
            disabled={submitting || narrowingError !== null}
          >
            {submitting ? <Spinner /> : null}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
