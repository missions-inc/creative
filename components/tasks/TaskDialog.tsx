"use client";

import { useState } from "react";
import type { Timestamp } from "firebase/firestore";

import { useAuth } from "@/components/auth/AuthProvider";
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
import { canManageClients, canManageProjects } from "@/lib/auth/roles";
import { fromDateTimeLocalValue, toDateTimeLocalValue } from "@/lib/date";
import {
  createClient,
  createProject,
  createTask,
} from "@/lib/firebase/mutations";
import {
  ROLE_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type AppUser,
  type Client,
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

/** プロジェクト選択欄の特別な選択肢。 */
const NEW_PROJECT = "__new_project__";
const NEW_CLIENT = "__new_client__";

/**
 * タスクの作成・編集ダイアログ。2 つのモードがある。
 *
 * 1. 固定モード（従来どおり）: `project` を渡す。
 *    プロジェクト詳細ページからの作成・編集で使用し、保存処理は `onSubmit` に委譲。
 *
 * 2. ピッカーモード（ダッシュボード用）: `project` を渡さず
 *    `projects` と `clients` を渡す。クライアント → プロジェクトの順に選択して
 *    タスクを作成できる（プロジェクトは選択クライアントのものだけに絞り込み、
 *    クライアントを変えると選択済みプロジェクトはリセット）。
 *    PM 以上には「＋新規プロジェクト」、admin には「＋新規クライアント」の
 *    選択肢を出してその場で作成できる（§3.2 / ルールでも強制）。
 *    保存処理はダイアログ内で行う（作成のみ）。
 *
 * どちらのモードでも公開範囲の「狭める方向のみ」（境界ルール2）は
 * VisibilityEditor + validateNarrowing + Firestore ルールで担保される。
 */
export function TaskDialog({
  open,
  onOpenChange,
  title,
  project,
  projects = [],
  clients = [],
  users,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** 固定モード: 対象プロジェクト。省略時はピッカーモード。 */
  project?: Project;
  /** ピッカーモード: 選択可能なプロジェクト（アクセス可能なもののみ渡すこと）。 */
  projects?: Project[];
  /** ピッカーモード: クライアント一覧（削除済みは除いて渡すこと）。 */
  clients?: Client[];
  users: AppUser[];
  initial?: Task;
  /** 固定モードの保存処理。ピッカーモードでは使われない。 */
  onSubmit?: (values: TaskFormValues) => Promise<void>;
}) {
  const { appUser } = useAuth();
  const pickerMode = !project;
  const canCreateProject = canManageProjects(appUser?.role);
  const canCreateClient = canManageClients(appUser?.role);

  // --- タスクフィールド ---
  const [taskTitle, setTaskTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [dueAtValue, setDueAtValue] = useState("");
  const [status, setStatus] = useState<TaskStatus>("not_started");
  const [priority, setPriority] = useState<TaskPriority>("mid");
  // 既定はプロジェクトの visibility を継承（§3.5）。
  const [visibility, setVisibility] = useState<Visibility>({ mode: "all" });

  // --- ピッカーモード: クライアント → プロジェクトの連動選択 / インライン新規作成 ---
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [npName, setNpName] = useState("");
  const [npClientName, setNpClientName] = useState("");
  // 新規プロジェクトの公開範囲。既存の作成画面（ProjectDialog）と同じ既定値。
  const [npVisibility, setNpVisibility] = useState<Visibility>({ mode: "all" });

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
      setVisibility(initial?.visibility ?? project?.visibility ?? { mode: "all" });
      setSelectedClientId("");
      setSelectedProjectId("");
      setNpName("");
      setNpClientName("");
      setNpVisibility({ mode: "all" });
      setError(null);
    }
  }

  const creatingNewClient = pickerMode && selectedClientId === NEW_CLIENT;
  const creatingNewProject = pickerMode && selectedProjectId === NEW_PROJECT;
  const selectedProject = pickerMode
    ? projects.find((p) => p.id === selectedProjectId)
    : project;

  // 選択肢に出すクライアント（アクセス可能なもののみ）:
  //   - クライアント自体は全メンバーが読めるが、プロジェクトを作れないメンバーには
  //     「アクセスできるプロジェクトを持つクライアント」だけを出す（選んでも空になるため）。
  //   - PM 以上は新規プロジェクトの作成先として全クライアントを選べる。
  const selectableClients = (() => {
    if (canCreateProject) return clients;
    const ids = new Set(projects.map((p) => p.clientId));
    return clients.filter((c) => ids.has(c.id));
  })();

  // プロジェクトの選択肢は選択中クライアントのものだけ（連動絞り込み）。
  const clientProjects = projects.filter((p) => p.clientId === selectedClientId);

  // タスクの公開範囲の「親」。新規プロジェクトの場合は編集中の公開範囲が親になる。
  const parentVisibility = creatingNewProject
    ? npVisibility
    : selectedProject?.visibility;

  const projectChosen = Boolean(selectedProject) || creatingNewProject;
  const narrowingError = parentVisibility
    ? validateNarrowing(visibility, parentVisibility)
    : null;

  /**
   * クライアント選択が変わったら、選択済みプロジェクトをリセットする。
   * 「＋新規クライアント」の場合は既存プロジェクトが存在しないので
   * 自動的に「＋新規プロジェクト」を選択状態にする。
   */
  const onSelectClient = (value: string) => {
    setSelectedClientId(value);
    if (value === NEW_CLIENT) {
      setSelectedProjectId(NEW_PROJECT);
      setVisibility(npVisibility);
    } else {
      setSelectedProjectId("");
    }
  };

  /** プロジェクト選択が変わったら、タスクの公開範囲を親の継承値にリセットする。 */
  const onSelectProject = (value: string) => {
    setSelectedProjectId(value);
    if (value === NEW_PROJECT) {
      setVisibility(npVisibility);
    } else {
      const p = projects.find((x) => x.id === value);
      if (p) setVisibility(p.visibility);
    }
  };

  /** 新規プロジェクトの公開範囲を変えたら、タスク側も継承し直す（親より広がるのを防ぐ）。 */
  const onChangeNpVisibility = (v: Visibility) => {
    setNpVisibility(v);
    setVisibility(v);
  };

  const toggleAssignee = (uid: string, checked: boolean) => {
    setAssignees((prev) =>
      checked ? [...prev, uid] : prev.filter((u) => u !== uid),
    );
  };

  const submit = async () => {
    if (pickerMode && !selectedClientId)
      return setError("クライアントを選択してください。");
    if (pickerMode && !projectChosen)
      return setError("プロジェクトを選択してください。");
    if (creatingNewClient && !npClientName.trim())
      return setError("クライアント名を入力してください。");
    if (creatingNewProject && !npName.trim())
      return setError("プロジェクト名を入力してください。");
    if (!taskTitle.trim()) return setError("タイトルを入力してください。");
    if (narrowingError) return setError(narrowingError);

    setSubmitting(true);
    setError(null);
    try {
      const values: TaskFormValues = {
        title: taskTitle,
        description,
        assignees,
        dueAt: fromDateTimeLocalValue(dueAtValue),
        status,
        priority,
        visibility,
      };

      if (!pickerMode) {
        // 固定モード: 保存処理は呼び出し元（作成 or 更新）に委譲。
        await onSubmit?.(values);
      } else {
        if (!appUser) throw new Error("ログイン情報を確認できませんでした。");
        let projectId: string;
        let clientId: string;

        if (creatingNewProject) {
          // クライアントの新規作成は admin のみ（§3.2 / ルールでも強制）。
          clientId = creatingNewClient
            ? (await createClient({ name: npClientName })).id
            : selectedClientId;
          const projectRef = await createProject({
            clientId,
            name: npName,
            visibility: npVisibility,
          });
          projectId = projectRef.id;
        } else {
          projectId = selectedProject!.id;
          clientId = selectedProject!.clientId;
        }

        await createTask({ projectId, clientId, ...values }, appUser.uid);
      }
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
          {pickerMode ? (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              {/* クライアント → プロジェクトの順で選択（連動絞り込み） */}
              <div className="space-y-1.5">
                <Label>クライアント</Label>
                <Select value={selectedClientId} onValueChange={onSelectClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectableClients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                    {/* クライアント登録は admin のみ（§3.2）。権限がなければ出さない */}
                    {canCreateClient ? (
                      <SelectItem value={NEW_CLIENT}>
                        ＋ 新規クライアントを登録...
                      </SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
                {canCreateProject && !canCreateClient ? (
                  <p className="text-xs text-muted-foreground">
                    クライアントの新規登録は管理者のみ行えます。
                  </p>
                ) : null}
              </div>

              {creatingNewClient ? (
                <div className="space-y-1.5">
                  <Label htmlFor="np-client-name">新規クライアント名</Label>
                  <Input
                    id="np-client-name"
                    value={npClientName}
                    onChange={(e) => setNpClientName(e.target.value)}
                    placeholder="株式会社〇〇"
                  />
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label>プロジェクト</Label>
                <Select
                  value={selectedProjectId}
                  onValueChange={onSelectProject}
                  disabled={!selectedClientId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        selectedClientId
                          ? "選択してください"
                          : "先にクライアントを選択してください"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {clientProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                    {/* プロジェクト作成は PM 以上のみ（§3.2）。権限がなければ出さない */}
                    {canCreateProject ? (
                      <SelectItem value={NEW_PROJECT}>
                        ＋ 新規プロジェクトを作成...
                      </SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
                {selectedClientId &&
                !creatingNewClient &&
                clientProjects.length === 0 &&
                !canCreateProject ? (
                  <p className="text-xs text-muted-foreground">
                    このクライアントに選択できるプロジェクトがありません。
                  </p>
                ) : null}
              </div>

              {creatingNewProject ? (
                <div className="space-y-3 border-t pt-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="np-name">プロジェクト名</Label>
                    <Input
                      id="np-name"
                      value={npName}
                      onChange={(e) => setNpName(e.target.value)}
                      placeholder="サイトリニューアル"
                    />
                  </div>

                  {/* 新規プロジェクトの公開範囲（既定は「全メンバー」= 既存の作成画面と同じ） */}
                  <VisibilityEditor
                    value={npVisibility}
                    onChange={onChangeNpVisibility}
                    users={users}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

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
          {parentVisibility ? (
            <VisibilityEditor
              value={visibility}
              onChange={setVisibility}
              parent={parentVisibility}
              users={users}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              公開範囲はプロジェクトを選択すると設定できます（プロジェクトの範囲を継承します）。
            </p>
          )}

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
            disabled={
              submitting ||
              narrowingError !== null ||
              (pickerMode && !projectChosen)
            }
          >
            {submitting ? <Spinner /> : null}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
