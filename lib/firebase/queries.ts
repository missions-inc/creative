"use client";

/**
 * =============================================================================
 * アクセス可能なドキュメントだけを取得するクエリ戦略
 * -----------------------------------------------------------------------------
 * 重要: Firestore のセキュリティルールは「フィルタ」ではない。
 * アクセスできないドキュメントを 1 件でも含みうるクエリは、クエリ全体が
 * PERMISSION_DENIED で失敗する。
 *
 * さらに重要な性質として、`list`（クエリ）ではルールは「実ドキュメント」ではなく
 * 「クエリそのもの」に対して評価される。`resource.data` の各フィールドは、
 * クエリの制約から値を証明できる場合にのみ参照でき、証明できないフィールドを
 * 参照すると評価エラー（= 拒否）になる。
 * ルールは三値論理で評価されるため `false OR エラー OR 証明可能なtrue` は許可される。
 *
 * したがって各クエリは「ルールのいずれか 1 つの分岐を証明できる」形にする必要がある。
 * firestore.rules の canAccessTaskData / canAccessProjectData と 1:1 で対応させること：
 *
 *   mode=='all'                                        → visAllows の第1分岐が真と証明できる
 *   mode=='role_limited'   + roles array-contains ロール → 第2分岐が真と証明できる
 *   mode=='member_limited' + memberUids array-contains UID → 第3分岐が真と証明できる
 *   assignees array-contains UID                        → 担当者分岐が真（境界ルール1）
 *
 * ※ mode の等値制約を省くと `vis.mode` が証明できずエラーになる（実際に検証済み）。
 *   そのため mode + array-contains の複合インデックスが必要（firestore.indexes.json）。
 *
 * admin はルール上すべて読めるうえ、isAdmin() は resource.data を参照しないため
 * 制約なしの単一クエリで良い。
 *
 * `isDeleted` の除外と並び替えはクライアント側で行う（これらを Firestore 側の
 * 制約にすると、さらに多くの複合インデックスが必要になるため）。
 * =============================================================================
 */
import {
  onSnapshot,
  query,
  where,
  type FirestoreError,
  type Query,
} from "firebase/firestore";

import type { Project, Role, Task } from "@/types";
import { projectsCol, tasksCol } from "./converters";

/** プロジェクトのうち、当該ユーザーが読めるものを取得するクエリ群。 */
export function accessibleProjectQueries(
  role: Role,
  uid: string,
): Query<Project>[] {
  const col = projectsCol();
  if (role === "admin") return [query(col)];
  return [
    query(col, where("visibility.mode", "==", "all")),
    query(
      col,
      where("visibility.mode", "==", "role_limited"),
      where("visibility.roles", "array-contains", role),
    ),
    query(
      col,
      where("visibility.mode", "==", "member_limited"),
      where("visibility.memberUids", "array-contains", uid),
    ),
  ];
}

/** タスクのうち、当該ユーザーが読めるものを取得するクエリ群。 */
export function accessibleTaskQueries(role: Role, uid: string): Query<Task>[] {
  const col = tasksCol();
  if (role === "admin") return [query(col)];
  return [
    query(col, where("visibility.mode", "==", "all")),
    query(
      col,
      where("visibility.mode", "==", "role_limited"),
      where("visibility.roles", "array-contains", role),
    ),
    query(
      col,
      where("visibility.mode", "==", "member_limited"),
      where("visibility.memberUids", "array-contains", uid),
    ),
    // 境界ルール1: 担当者は visibility 外でも常にアクセス可。
    query(col, where("assignees", "array-contains", uid)),
  ];
}

/**
 * 複数クエリを購読し、id で重複排除してマージした結果を通知する。
 * 戻り値は解除関数。
 */
export function subscribeMerged<T extends { id: string }>(
  queries: Query<T>[],
  onData: (items: T[]) => void,
  onError?: (error: FirestoreError) => void,
): () => void {
  const buckets: Map<string, T>[] = queries.map(() => new Map());

  const emit = () => {
    const merged = new Map<string, T>();
    for (const bucket of buckets) {
      for (const [id, item] of bucket) merged.set(id, item);
    }
    onData(Array.from(merged.values()));
  };

  const unsubscribes = queries.map((q, index) =>
    onSnapshot(
      q,
      (snap) => {
        buckets[index] = new Map(snap.docs.map((d) => [d.id, d.data()]));
        emit();
      },
      (error) => onError?.(error),
    ),
  );

  return () => unsubscribes.forEach((u) => u());
}
