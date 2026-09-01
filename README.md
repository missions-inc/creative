# タスク管理アプリ（クライアント別・プロジェクト別）

Missions 社内向けの、クライアント別・プロジェクト別タスク管理 Web アプリ。

- **フロントエンド**: Next.js（App Router）+ TypeScript + Tailwind CSS + shadcn/ui
- **認証**: Firebase Authentication（Google OAuth / `missions.co.jp` ドメイン限定）
- **DB**: Cloud Firestore
- **ファイル**: Firebase Storage
- **ホスティング**: Firebase Hosting（Web Frameworks 連携）
- **通知**: Web Push（Service Worker）+ Firebase Cloud Messaging
- **サーバー処理・定期処理**: Cloud Functions for Firebase
- **アクセス制御**: Firestore / Storage セキュリティルール

> パッケージマネージャは **pnpm** を使用します。

---

## セットアップ手順

### 1. 前提

- Node.js 20 以上（推奨 22）
- pnpm 11 以上（`corepack enable pnpm` で有効化可）
- Java 11 以上（Firebase エミュレータでルールテストを実行する場合）
- Firebase プロジェクト（人間側で事前準備。§「事前準備」参照）

### 2. 依存関係のインストール

```bash
pnpm install
```

### 3. 環境変数の設定

`.env.example` をコピーして `.env.local` を作成し、Firebase コンソールから取得した値を入れます。

```bash
cp .env.example .env.local
```

| 変数 | 取得元 |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` 他 Web 設定 | Firebase コンソール > プロジェクトの設定 > 全般 > マイアプリ（ウェブ） |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Firebase コンソール > Cloud Messaging > ウェブ構成 > 鍵ペア |

- `.env.local` は `.gitignore` 済み。**秘密情報はコミットしないこと。**
- 許可ドメイン（`missions.co.jp`）と初期管理者（`s.matsumoto@missions.co.jp`）は仕様で確定済みのため既定値を持ちます。

### 4. 開発サーバー起動

```bash
pnpm dev
# http://localhost:3000
```

### 5. Firebase エミュレータ（任意・ローカル検証用）

`.env.local` で `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` にすると、Auth / Firestore / Storage がローカルエミュレータに接続します。

```bash
pnpm emulators           # Auth/Firestore/Storage エミュレータ起動
pnpm test:rules          # セキュリティルールの単体テスト（Phase 2 で追加）
```

---

## デプロイ（概要 / 詳細は Phase 8 で最終化）

```bash
# 初回のみ: Firebase CLI ログインと Web Frameworks 実験機能の有効化
pnpm dlx firebase-tools login
pnpm dlx firebase-tools experiments:enable webframeworks

# .firebaserc の "default" を実プロジェクト ID に書き換えたうえで
pnpm dlx firebase-tools deploy --only firestore:rules,storage,hosting,functions
```

---

## ディレクトリ構成

```
app/                    Next.js App Router（画面）
  layout.tsx            ルートレイアウト
  page.tsx              エントリ
  globals.css           Tailwind + shadcn CSS 変数
components/
  ui/                   shadcn/ui コンポーネント
lib/
  firebase/
    config.ts           公開設定値・ドメイン判定
    client.ts           クライアント SDK 初期化（ブラウザ専用）
    admin.ts            Admin SDK 初期化（サーバー専用 / "server-only"）
  utils.ts              cn() ほかユーティリティ
types/                  Firestore ドキュメントの型（Phase 2）
functions/              Cloud Functions（通知・定期処理・自動追従）
firestore.rules         Firestore セキュリティルール
storage.rules           Storage セキュリティルール
firestore.indexes.json  複合インデックス定義
firebase.json           Firebase 各種設定・エミュレータ設定
```

---

## 事前準備（人間側 / コードでは作成不可）

- Firebase プロジェクト作成
- Authentication で Google プロバイダ有効化、承認済みドメイン設定
- Google Cloud の OAuth 同意画面（内部利用・`missions.co.jp` 制限）
- Firestore / Storage 有効化、Blaze プランと予算アラート
- FCM の VAPID キー発行

---

## 実装フェーズの記録

### ✅ Phase 0 — プロジェクト初期化
- Next.js（App Router, TypeScript）+ Tailwind CSS + shadcn/ui の scaffold
- Firebase SDK（client / admin 分離）導入、`.env.example` / `.env.local` の雛形
- `firebase.json` / `firestore.rules` / `storage.rules` / `firestore.indexes.json` / `.firebaserc` の雛形（ルールは Phase 2 で実装。現状はセーフデフォルトで全拒否）
- Cloud Functions ディレクトリの雛形（実装は Phase 6/7）
- 動作確認: `pnpm typecheck` / `pnpm build` が成功

### ✅ Phase 1 — 認証とロール基盤
- Google ログイン（`signInWithPopup`）。`hd` ヒント + アプリ側検証で **`missions.co.jp` ドメイン限定**（ドメイン外は即サインアウト + エラー表示）
- 初回ログイン時に `users/{uid}` を作成。`s.matsumoto@missions.co.jp` は `admin` 自動付与、それ以外は `member`（`lib/firebase/users.ts`）
- `AuthProvider`（`onAuthStateChanged` によるログイン状態管理）、`useAuth()` フック
- `RequireAuth` による保護ルート、未ログイン時の `/login` リダイレクト、ログアウト
- ルーティング: `/` → 状態に応じて `/dashboard` or `/login`、`/login`、`/dashboard`（保護エリア `(app)` グループ）
- データモデルの型定義（`types/index.ts`）を先行整備
- 動作確認: `pnpm typecheck` / `pnpm lint` / `pnpm build` 成功

> ⚠️ 実際にログインを試すには `.env.local` に Firebase 設定値が必要です（未設定だとブラウザで初期化エラー）。

### ✅ Phase 2 — データモデルとセキュリティルール
- 全コレクションの TypeScript 型（`types/index.ts`）と Firestore 変換層（`lib/firebase/converters.ts`、型付きコレクション参照）
- **アクセス制御の唯一の真実**を `lib/access/visibility.ts` に集約（`visibilityAllows` / `canAccessProject` / `canAccessTask` / `isNarrowerOrEqual`）。クライアント表示・ルール・Cloud Functions で一貫させる（§6）
- **Firestore ルール**（`firestore.rules`）: ロール別権限 + 公開範囲 `all/role_limited/member_limited` + **担当者常時アクセス**（境界ルール1）+ **狭める方向のみ**（境界ルール2）+ ロール自己昇格防止 + 初期管理者ブートストラップ
- **Storage ルール**（`storage.rules`）: 添付の 10MB・形式制限に加え、`firestore.get` でタスクアクセスを検証
- **ルール単体テスト**（`@firebase/rules-unit-testing` + Vitest、`tests/rules/`）: **40 ケースすべて green**
  - 実行: `pnpm test:rules`（Firestore エミュレータを自動起動。Java 必須）

> 「狭める方向のみ」は健全性最優先の保守的定義です。`role_limited` の親に対する `member_limited` の子は
> （各メンバーのロールをルールで安価に検証できないため）ルール上は拒否されます。
> 特定個人へ限定したい場合は **担当者（assignees）** を使ってください（担当者は常時アクセス可）。

### ⏳ Phase 3 以降
（各フェーズ完了時にここへ追記していきます）
