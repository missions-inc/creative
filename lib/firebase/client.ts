"use client";

/**
 * Firebase クライアント SDK の初期化（ブラウザ実行専用）。
 * サーバー側（Admin SDK）とは明確に分離する。→ lib/firebase/admin.ts
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import {
  connectStorageEmulator,
  getStorage,
  type FirebaseStorage,
} from "firebase/storage";
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from "firebase/functions";

import { firebaseConfig, USE_FIREBASE_EMULATORS } from "./config";

let cachedApp: FirebaseApp | null = null;
const emulatorConnected = {
  auth: false,
  firestore: false,
  storage: false,
  functions: false,
};

/** Cloud Functions のリージョン（functions/src/index.ts と一致させること）。 */
export const FUNCTIONS_REGION = "asia-northeast1";

/** Firebase App のシングルトンを返す（多重初期化を防ぐ）。 */
export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return cachedApp;
}

export function getFirebaseAuth(): Auth {
  const auth = getAuth(getFirebaseApp());
  if (shouldConnectEmulator("auth")) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    emulatorConnected.auth = true;
  }
  return auth;
}

export function getDb(): Firestore {
  const db = getFirestore(getFirebaseApp());
  if (shouldConnectEmulator("firestore")) {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    emulatorConnected.firestore = true;
  }
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  const storage = getStorage(getFirebaseApp());
  if (shouldConnectEmulator("storage")) {
    connectStorageEmulator(storage, "127.0.0.1", 9199);
    emulatorConnected.storage = true;
  }
  return storage;
}

export function getFirebaseFunctions(): Functions {
  const functions = getFunctions(getFirebaseApp(), FUNCTIONS_REGION);
  if (shouldConnectEmulator("functions")) {
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    emulatorConnected.functions = true;
  }
  return functions;
}

/** ローカル開発時（ブラウザ）で、当該サービスがまだ未接続なら true。 */
function shouldConnectEmulator(service: keyof typeof emulatorConnected): boolean {
  return (
    USE_FIREBASE_EMULATORS &&
    typeof window !== "undefined" &&
    !emulatorConnected[service]
  );
}
