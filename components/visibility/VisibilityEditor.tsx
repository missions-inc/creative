"use client";

/**
 * 公開範囲エディタ（仕様書 §3.3）。
 *
 * `parent` を渡すと「狭める方向のみ」を UI レベルで強制する：
 *   - 選べるモードを allowedChildModes に限定
 *   - ロール/メンバーの選択肢を親の範囲内に限定
 *   - それでも不整合なら validateNarrowing のメッセージを表示
 * 最終的な拒否は firestore.rules（isNarrowerOrEqual）が担保する。
 */
import {
  allowedChildModes,
  selectableMemberUids,
  selectableRoles,
  validateNarrowing,
} from "@/lib/access/visibility";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ROLE_LABELS,
  VISIBILITY_MODE_LABELS,
  type AppUser,
  type Role,
  type Visibility,
  type VisibilityMode,
} from "@/types";

export function VisibilityEditor({
  value,
  onChange,
  parent,
  users,
  disabled,
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
  parent?: Visibility;
  users: AppUser[];
  disabled?: boolean;
}) {
  const modes = allowedChildModes(parent);
  const roleChoices = selectableRoles(parent);
  const memberWhitelist = selectableMemberUids(parent);
  const memberChoices =
    memberWhitelist === null
      ? users
      : users.filter((u) => memberWhitelist.includes(u.uid));

  const error = validateNarrowing(value, parent);

  const setMode = (mode: VisibilityMode) => {
    if (mode === "all") onChange({ mode: "all" });
    else if (mode === "role_limited")
      onChange({ mode: "role_limited", roles: roleChoices });
    else onChange({ mode: "member_limited", memberUids: [] });
  };

  const toggleRole = (role: Role, checked: boolean) => {
    if (value.mode !== "role_limited") return;
    onChange({
      mode: "role_limited",
      roles: checked
        ? [...value.roles, role]
        : value.roles.filter((r) => r !== role),
    });
  };

  const toggleMember = (uid: string, checked: boolean) => {
    if (value.mode !== "member_limited") return;
    onChange({
      mode: "member_limited",
      memberUids: checked
        ? [...value.memberUids, uid]
        : value.memberUids.filter((u) => u !== uid),
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>公開範囲</Label>
        <Select
          value={value.mode}
          onValueChange={(m) => setMode(m as VisibilityMode)}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {modes.map((m) => (
              <SelectItem key={m} value={m}>
                {VISIBILITY_MODE_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {parent ? (
          <p className="text-xs text-muted-foreground">
            プロジェクトの範囲内でのみ設定できます（広げることはできません）。
          </p>
        ) : null}
      </div>

      {value.mode === "role_limited" ? (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            許可するロール
          </p>
          <div className="flex flex-wrap gap-4">
            {roleChoices.map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={value.roles.includes(role)}
                  onCheckedChange={(c) => toggleRole(role, c === true)}
                  disabled={disabled}
                />
                {ROLE_LABELS[role]}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {value.mode === "member_limited" ? (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            許可するメンバー
          </p>
          {memberChoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              選択できるメンバーがいません。
            </p>
          ) : (
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {memberChoices.map((u) => (
                <label key={u.uid} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={value.memberUids.includes(u.uid)}
                    onCheckedChange={(c) => toggleMember(u.uid, c === true)}
                    disabled={disabled}
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
          )}
          <p className="text-xs text-muted-foreground">
            担当者は、ここに含まれていなくても常にアクセスできます。
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
