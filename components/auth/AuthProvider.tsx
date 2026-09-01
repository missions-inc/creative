"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";

import { getFirebaseAuth } from "@/lib/firebase/client";
import {
  ALLOWED_EMAIL_DOMAIN,
  isAllowedDomain,
} from "@/lib/firebase/config";
import { ensureUserDocument } from "@/lib/firebase/users";
import type { AppUser } from "@/types";

interface AuthContextValue {
  /** Firebase Auth の生ユーザー（未ログインなら null）。 */
  firebaseUser: User | null;
  /** Firestore 上のアプリユーザー（ロール等を含む）。 */
  appUser: AppUser | null;
  /** 認証状態の初期判定が完了したか。 */
  loading: boolean;
  /** ログイン/ドメイン検証時のエラーメッセージ。 */
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setFirebaseUser(null);
          setAppUser(null);
          return;
        }

        // ドメイン検証（仕様書 §3.1）: missions.co.jp 以外は即サインアウト。
        if (!isAllowedDomain(user.email)) {
          await fbSignOut(auth);
          setFirebaseUser(null);
          setAppUser(null);
          setError(
            `${ALLOWED_EMAIL_DOMAIN} のアカウントのみ利用できます。`,
          );
          return;
        }

        setFirebaseUser(user);
        const profile = await ensureUserDocument(user);
        setAppUser(profile);
        setError(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    // Google 側でもドメインを絞る（hd ヒント）。最終検証はアプリ側で行う。
    provider.setCustomParameters({ hd: ALLOWED_EMAIL_DOMAIN });
    try {
      const cred = await signInWithPopup(auth, provider);
      if (!isAllowedDomain(cred.user.email)) {
        await fbSignOut(auth);
        setError(`${ALLOWED_EMAIL_DOMAIN} のアカウントのみ利用できます。`);
      }
      // 成功時は onAuthStateChanged 側で appUser を確定させる。
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        return; // ユーザーがポップアップを閉じただけ。
      }
      setError("ログインに失敗しました。時間をおいて再度お試しください。");
    }
  }, []);

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth();
    await fbSignOut(auth);
    setFirebaseUser(null);
    setAppUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      appUser,
      loading,
      error,
      signInWithGoogle,
      signOut,
    }),
    [firebaseUser, appUser, loading, error, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth は AuthProvider の内側で使用してください。");
  }
  return ctx;
}
