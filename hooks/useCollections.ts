"use client";

/**
 * Firestore のリアルタイム購読フック群。
 * 公開範囲に応じた複数クエリのマージは lib/firebase/queries.ts が担当する。
 * `isDeleted` の除外と並び替えはクライアント側で行う（Phase 3 時点では
 * 複合インデックス不要のクエリ構成にしているため）。
 */
import { useEffect, useMemo, useState } from "react";
import { onSnapshot, type FirestoreError } from "firebase/firestore";

import { useAuth } from "@/components/auth/AuthProvider";
import { clientsCol, usersCol } from "@/lib/firebase/converters";
import {
  accessibleProjectQueries,
  accessibleTaskQueries,
  subscribeMerged,
} from "@/lib/firebase/queries";
import type { AppUser, Client, Project, Task } from "@/types";

interface CollectionState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

const initialState = { data: [], loading: true, error: null };

/** 全メンバー（担当者選択・メンバー限定の選択肢に使う）。 */
export function useUsers(): CollectionState<AppUser> {
  const [state, setState] = useState<CollectionState<AppUser>>(initialState);

  useEffect(() => {
    const unsub = onSnapshot(
      usersCol(),
      (snap) =>
        setState({
          data: snap.docs
            .map((d) => d.data())
            .sort((a, b) =>
              (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email),
            ),
          loading: false,
          error: null,
        }),
      (e: FirestoreError) =>
        setState({ data: [], loading: false, error: e.message }),
    );
    return unsub;
  }, []);

  return state;
}

/** クライアント一覧（missions ユーザーは全件読める）。 */
export function useClients(includeDeleted = false): CollectionState<Client> {
  const [state, setState] = useState<CollectionState<Client>>(initialState);

  useEffect(() => {
    const unsub = onSnapshot(
      clientsCol(),
      (snap) =>
        setState({
          data: snap.docs.map((d) => d.data()),
          loading: false,
          error: null,
        }),
      (e: FirestoreError) =>
        setState({ data: [], loading: false, error: e.message }),
    );
    return unsub;
  }, []);

  const data = useMemo(
    () =>
      state.data
        .filter((c) => includeDeleted || !c.isDeleted)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [state.data, includeDeleted],
  );

  return { ...state, data };
}

/** アクセス可能なプロジェクト一覧。 */
export function useProjects(includeDeleted = false): CollectionState<Project> {
  const { appUser } = useAuth();
  const [state, setState] = useState<CollectionState<Project>>(initialState);

  const role = appUser?.role;
  const uid = appUser?.uid;

  useEffect(() => {
    if (!role || !uid) return;
    const unsub = subscribeMerged<Project>(
      accessibleProjectQueries(role, uid),
      (items) => setState({ data: items, loading: false, error: null }),
      (e) => setState({ data: [], loading: false, error: e.message }),
    );
    return unsub;
  }, [role, uid]);

  const data = useMemo(
    () =>
      state.data
        .filter((p) => includeDeleted || !p.isDeleted)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [state.data, includeDeleted],
  );

  return { ...state, data };
}

/** アクセス可能なタスク一覧（担当者常時アクセスを含む）。 */
export function useTasks(options?: {
  projectId?: string;
  includeDeleted?: boolean;
}): CollectionState<Task> {
  const { appUser } = useAuth();
  const [state, setState] = useState<CollectionState<Task>>(initialState);

  const role = appUser?.role;
  const uid = appUser?.uid;
  const projectId = options?.projectId;
  const includeDeleted = options?.includeDeleted ?? false;

  useEffect(() => {
    if (!role || !uid) return;
    const unsub = subscribeMerged<Task>(
      accessibleTaskQueries(role, uid),
      (items) => setState({ data: items, loading: false, error: null }),
      (e) => setState({ data: [], loading: false, error: e.message }),
    );
    return unsub;
  }, [role, uid]);

  const data = useMemo(
    () =>
      state.data
        .filter((t) => includeDeleted || !t.isDeleted)
        .filter((t) => !projectId || t.projectId === projectId)
        .sort((a, b) => {
          // 期日あり → 期日昇順、期日なしは末尾。
          const av = a.dueAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
          const bv = b.dueAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
          if (av !== bv) return av - bv;
          return a.title.localeCompare(b.title);
        }),
    [state.data, projectId, includeDeleted],
  );

  return { ...state, data };
}
