"use client";

/**
 * Firestore の型安全な変換層（withConverter）。
 * 読み出し時に `id` を付与し、書き込み時に `id` を除去する。
 * 各コレクション/ドキュメントへの型付き参照ヘルパーも提供する。
 */
import {
  collection,
  collectionGroup,
  doc,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { getDb } from "./client";
import type {
  AppNotification,
  AppUser,
  Attachment,
  Client,
  Comment,
  Project,
  Task,
} from "@/types";

/** `id` を持つ型 T のための汎用コンバータを生成する。 */
function withId<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore(model: T): DocumentData {
      // id はドキュメントパスが持つため保存データからは除外する。
      const { id: _omit, ...rest } = model;
      void _omit;
      return rest as DocumentData;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): T {
      return { id: snapshot.id, ...(snapshot.data() as Omit<T, "id">) } as T;
    },
  };
}

export const userConverter: FirestoreDataConverter<AppUser> = {
  toFirestore(u: AppUser): DocumentData {
    const { uid: _omit, ...rest } = u;
    void _omit;
    return rest as DocumentData;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): AppUser {
    return { uid: snapshot.id, ...(snapshot.data() as Omit<AppUser, "uid">) };
  },
};

export const clientConverter = withId<Client>();
export const projectConverter = withId<Project>();
export const taskConverter = withId<Task>();
export const commentConverter = withId<Comment>();
export const attachmentConverter = withId<Attachment>();
export const notificationConverter = withId<AppNotification>();

// --- コレクション参照ヘルパー -------------------------------------------------

export const usersCol = (): CollectionReference<AppUser> =>
  collection(getDb(), "users").withConverter(userConverter);

export const userDoc = (uid: string): DocumentReference<AppUser> =>
  doc(getDb(), "users", uid).withConverter(userConverter);

export const clientsCol = (): CollectionReference<Client> =>
  collection(getDb(), "clients").withConverter(clientConverter);

export const clientDoc = (id: string): DocumentReference<Client> =>
  doc(getDb(), "clients", id).withConverter(clientConverter);

export const projectsCol = (): CollectionReference<Project> =>
  collection(getDb(), "projects").withConverter(projectConverter);

export const projectDoc = (id: string): DocumentReference<Project> =>
  doc(getDb(), "projects", id).withConverter(projectConverter);

export const tasksCol = (): CollectionReference<Task> =>
  collection(getDb(), "tasks").withConverter(taskConverter);

export const taskDoc = (id: string): DocumentReference<Task> =>
  doc(getDb(), "tasks", id).withConverter(taskConverter);

export const commentsCol = (taskId: string): CollectionReference<Comment> =>
  collection(getDb(), "tasks", taskId, "comments").withConverter(
    commentConverter,
  );

export const attachmentsCol = (
  taskId: string,
): CollectionReference<Attachment> =>
  collection(getDb(), "tasks", taskId, "attachments").withConverter(
    attachmentConverter,
  );

export const notificationsCol = (): CollectionReference<AppNotification> =>
  collection(getDb(), "notifications").withConverter(notificationConverter);

/** コメントを横断検索する場合のコレクショングループ。 */
export const commentsGroup = () =>
  collectionGroup(getDb(), "comments").withConverter(commentConverter);
