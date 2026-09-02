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
pnpm test                # 単体テスト + ルールテスト
```

---

## デプロイ手順（ランブック）

デプロイ先プロジェクトは `.firebaserc` に設定済み（`missions-coorpolate`）。

### 初回のみ

```bash
# 1) Firebase CLI にログインし、Web Frameworks 実験機能を有効化
pnpm dlx firebase-tools login
pnpm dlx firebase-tools experiments:enable webframeworks

# 2) 下記「環境前提: 組織ポリシーと IAM」の手動付与を実施

# 3) ダイジェストメールを使う場合（任意）
cp functions/.env.example functions/.env       # GMAIL_SMTP_USER を記入
pnpm dlx firebase-tools functions:secrets:set GMAIL_SMTP_PASSWORD
#   Gmail の「アプリ パスワード」を入力（2段階認証を有効化して
#   https://myaccount.google.com/apppasswords で発行。通常のパスワードは不可）
```

### 通常のデプロイ

```bash
# 全部まとめて
pnpm dlx firebase-tools deploy

# 変更対象だけ個別に
pnpm dlx firebase-tools deploy --only firestore:rules       # Firestore ルール
pnpm dlx firebase-tools deploy --only firestore:indexes     # 複合インデックス
pnpm dlx firebase-tools deploy --only storage               # Storage ルール
pnpm dlx firebase-tools deploy --only functions             # Cloud Functions（predeploy で自動ビルド）
pnpm dlx firebase-tools deploy --only hosting               # アプリ本体（Next.js）
```

### デプロイ後の動作確認チェックリスト

1. `missions.co.jp` アカウントでログインできる（ドメイン外は弾かれる）
2. `/settings` → 通知を有効化 → テスト送信が届く
3. タスクに担当者を割り当てると通知が届く
4. member ロールのアカウントでプロジェクト一覧が表示できる（複合インデックスの確認）
5. プロジェクトをゴミ箱に入れると配下タスクも連動する（Functions の確認）

### ⚠️ 環境前提: 組織ポリシーと IAM（実運用で確認済み）

この Google Cloud 組織では、組織ポリシーによりデフォルトのコンピュートサービスアカウント
（`1062122390649-compute@developer.gserviceaccount.com`）へ権限が**自動付与されません**。
新しい環境にデプロイする場合は、IAM で以下を手動付与してください。

| ロール | 目的 |
|---|---|
| **Logs Writer**（`roles/logging.logWriter`） | Cloud Build のビルド失敗対策 |
| **Cloud Datastore ユーザー**（`roles/datastore.user`） | Functions からの Firestore クエリ（PERMISSION_DENIED 対策） |
| **Firebase Cloud Messaging API 管理者** | FCM でのプッシュ送信 |

また、呼び出し可能関数（`sendTestNotification`）の Cloud Run サービスは
**「パブリックアクセスを許可」**にする必要があります（コード側でも `invoker: "public"` を
明示しているため通常は自動で設定されますが、組織ポリシーでブロックされた場合は
Cloud Run コンソールから手動で許可してください。認可は関数内のログイン必須＋ドメイン制限で担保しています）。

> ⚠️ **`firestore:indexes` の反映は必須**です。member / pm でのプロジェクト・タスク一覧は
> `visibility.mode` + `array-contains` の複合インデックスを使うため、未反映だと
> "The query requires an index" で失敗します（admin は制約なしクエリのため影響を受けません）。

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
    converters.ts       型付きコレクション参照（読み出し）
    mutations.ts        作成・更新・論理削除（書き込み）
    queries.ts          公開範囲に応じたクエリ戦略（重要）
  access/visibility.ts  アクセス制御判定の唯一の真実
  tasks/filters.ts      期日間近・マイタスクの絞り込み（Phase 6 と共用）
  date.ts               日時フォーマット・カレンダー日差分
  utils.ts              cn() ほかユーティリティ
hooks/useCollections.ts Firestore のリアルタイム購読フック
public/
  firebase-messaging-sw.js  FCM バックグラウンド受信用 Service Worker
types/                  Firestore ドキュメントの型
tests/
  unit/                 純粋ロジックの単体テスト（エミュレータ不要）
  rules/                セキュリティルールのテスト（エミュレータ必須）
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

### ✅ Phase 3 — クライアント／プロジェクト／タスクの CRUD
- **クライアント**（`/clients`・Admin 限定）: 登録・編集・論理削除／復元
- **プロジェクト**（`/projects`, `/projects/[projectId]`）: 作成・編集・論理削除／復元、クライアント別グルーピング表示、公開範囲設定 UI
- **タスク**（`/tasks/[taskId]`）: 作成・編集・ステータス変更（一覧からも即変更可）・優先度・担当者複数選択・期日（年月日＋時間）
- **公開範囲 UI**（`components/visibility/VisibilityEditor.tsx`）: 親の範囲外を選べないようモード／ロール／メンバーの選択肢自体を制限し、加えて `validateNarrowing` で警告。最終防御は Firestore ルール
- 期日が近い／超過したタスクは一覧で色分け表示

#### ⚠️ クエリ戦略（重要な実装上の知見）
Firestore のセキュリティルールは**フィルタではない**。さらに `list`（クエリ）では
ルールは「実ドキュメント」ではなく**クエリそのもの**に対して評価され、
`resource.data` はクエリの制約から値を証明できるフィールドしか参照できない。

そのため `lib/firebase/queries.ts` では公開範囲ごとにクエリを分割し、
**必ず `visibility.mode` の等値制約を併用**している（省くと `vis.mode` を証明できず
クエリ全体が拒否される。この挙動は回帰テストで固定済み）。

| クエリ | 証明できるルールの分岐 |
|---|---|
| `mode == 'all'` | 全員可 |
| `mode == 'role_limited'` + `roles array-contains <ロール>` | ロール限定 |
| `mode == 'member_limited'` + `memberUids array-contains <UID>` | メンバー限定 |
| `assignees array-contains <UID>` | 担当者常時アクセス |
| （admin）制約なし | `isAdmin()` は `resource.data` を参照しない |

これに伴い **複合インデックスが必要**（`firestore.indexes.json` に定義済み）。デプロイ時に反映してください:

```bash
pnpm dlx firebase-tools deploy --only firestore:indexes
```

- ルールテストは **50 ケース** に拡充（クエリ戦略の検証・回帰テストを含む）

### ✅ Phase 4 — 一覧画面・ダッシュボード
`/dashboard` を 3 つのタブで構成（§3.9）。いずれもアクセス制御を反映し、見えないものは表示しない。

| タブ | 内容 |
|---|---|
| **期日間近**【重要】 | 期日が「本日〜2日以内」の**未完了**タスク。加えて**期日超過**を上部に別枠で強調表示 |
| **マイタスク** | ログイン中ユーザーが `assignees` に入っている未完了タスク |
| **クライアント別** | クライアント ＞ プロジェクト ＞ タスクの階層で一括表示 |

- タブに件数バッジ、タスク行に「本日／あとN日／N日超過」の相対表示と色分け（超過=赤・2日以内=橙）
- 横断表示のタスク行にはクライアント／プロジェクトのパンくずを表示
- 「期日間近」の定義は `lib/tasks/filters.ts` に集約。**Phase 6 の毎朝のリマインド通知と同じ判定を使う**（二重管理を避ける）
- 階層表示は「担当者は常にアクセス可」により *プロジェクトは見えないがタスクだけ見える* ケースが起こりうるため、
  そのタスクをクライアント直下の「プロジェクト外」としてまとめる
- **単体テストを追加**（`tests/unit/`・エミュレータ不要）: 期日判定の境界、公開範囲の判定、
  UI ヘルパー（`allowedChildModes` 等）が `isNarrowerOrEqual` と整合することを検証

#### テストコマンド
```bash
pnpm test:unit    # 純粋ロジックの単体テスト（高速・エミュレータ不要）
pnpm test:rules   # セキュリティルールのテスト（Firestore エミュレータ・Java 必須）
pnpm test         # 上記の両方
```

### ✅ Phase 5 — コメント・添付ファイル
タスク詳細画面（`/tasks/[taskId]`）に追加。

**コメント（スレッド形式・§3.7）**
- `parentId` による返信のぶら下げ。インデントは 4 段までに制限
- 投稿者本人: 編集・削除／**PM 以上: 他人のコメントは「削除」のみ**（本文の編集は不可）
- 論理削除（`isDeleted`）。返信のつながりを保つため「このコメントは削除されました」を表示
- 編集済みは `(編集済み)` を表示

**添付ファイル（§3.6）**
- 1ファイル **10MB** まで／1タスク **10ファイル** まで／許可形式のみ
- 実体は Storage（`task-attachments/{taskId}/{attachmentId}/{fileName}`）、メタ情報は `attachments` サブコレクション
- 一覧・ダウンロード・削除（削除できるのは**アップロード者本人 or PM 以上**）
- ドキュメント ID を先に採番してパスに含めるため、**同名ファイルでも衝突しない**
- メタ情報の作成に失敗した場合は実体を削除し、孤児ファイルを残さない

#### 制約の三重化と整合性
サイズ・形式は **TypeScript / `firestore.rules` / `storage.rules`** の 3 箇所で検証している。
ずれると「クライアントは通すがルールが拒否する」等の不整合になるため、
**許可 MIME 一覧とサイズ上限がルールと一致することを単体テストで固定**している
（`tests/unit/attachments.test.ts` がルールファイルを読んで突き合わせる）。

ファイル数の上限だけはルールで件数を数えられないため、クライアント側の検証のみ。

> Storage の削除ルールはメタ情報ドキュメントの `uploadedBy` を参照するため、
> クライアントは **実体 → メタ情報** の順に削除する必要がある（`deleteAttachment` がその順序）。

### ✅ Phase 6 — 通知（Web Push + FCM + Cloud Functions）

**クライアント側**
- `/settings` に通知設定画面。**現在の許可状態のバッジ表示**・有効化・**通知テスト送信**・無効化（§6）
- Service Worker（`public/firebase-messaging-sw.js`）でバックグラウンド受信
- フォアグラウンド受信はブラウザが通知を出さないため、アプリ内トースト（`ForegroundNotifications`）で表示
- FCM トークンは `users/{uid}/fcmTokens/{token}` に保存。**本人以外は admin でも読めない**（端末固有情報のため）

> Service Worker はビルド時の環境変数を読めないため、**登録時にクエリパラメータで設定値を渡している**。
> 設定値をファイルにハードコードしていない。

> ⚠️ サーバーは `webpush.notification` を含むペイロードを送るため、FCM SDK が
> バックグラウンド通知を**自動表示**する。SW 内で `showNotification()` を呼ぶと**二重表示**になるので呼ばないこと。

**Cloud Functions（`asia-northeast1`）**

| 関数 | 種類 | 内容 |
|---|---|---|
| `onTaskWritten` | Firestore トリガー | 新規割り当て → 該当担当者へ／完了 → 作成者＋全担当者へ |
| `dailyDueReminder` | スケジュール | **毎朝 9:00 JST**、期日が**当日**または**2日前**の未完了タスクの担当者へ |
| `sendTestNotification` | 呼び出し可能 | 疎通確認用に自分宛へテスト送信 |

- 無効になった FCM トークンは送信結果を見て自動削除
- プッシュが届かなくても履歴が残るよう、`notifications` コレクションにも記録（作成は Admin SDK のみ）

#### 期日リマインドの定義（重要）
仕様どおり**当日(0日)と2日前(2日)ちょうど**が対象で、**1日前には送りません**。
ダッシュボードの「期日間近」が 0〜2 日の*範囲*を表示するのとは異なります。

Cloud Functions は UTC で動くため、カレンダー日の計算は **JST を明示**しています
（`functions/src/shared/dueDates.ts`）。アプリ側（ブラウザのローカル時刻）とは実装が分かれるので、
**両者の定数と判定結果が一致することを単体テストで突き合わせ**ています（`tests/unit/dueDates.test.ts`）。

#### 通知のデプロイと確認手順
```bash
# Cloud Functions をデプロイ（predeploy で自動的に TypeScript をビルド）
pnpm dlx firebase-tools deploy --only functions

# ルール（fcmTokens の保護を含む）も更新
pnpm dlx firebase-tools deploy --only firestore:rules
```

1. アプリの `/settings` を開く → 「この端末で通知を有効にする」→ ブラウザの許可ダイアログで許可
2. 「通知テスト送信」で疎通確認
3. 実際のタスクに担当者を割り当て → 割り当てられた人に通知が届くか確認

> `dailyDueReminder` は Cloud Scheduler を使うため **Blaze プラン**が必要です。
> 初回デプロイ時に Cloud Scheduler API の有効化を求められる場合があります。

#### 通知が動かないときの切り分け

**症状: テスト送信が `internal` で失敗し、`functions:log` にも何も出ない**

`internal` は「関数が例外を投げた」ときだけでなく、**リクエストが関数に到達していない**ときにも出ます。
到達していない場合は関数側のログにも何も残らないため、この2つは同じ見え方になります。

主な原因は **Cloud Run の呼び出し権限（invoker）が付与されていない**ことです。
第2世代の Cloud Functions は Cloud Run 上で動くため、invoker 権限がないと
リクエストは関数に届く前に 403 で弾かれます。このとき CORS ヘッダも返らないので、
ブラウザからは原因不明の `internal` として現れます。

対策として `sendTestNotification` には **`invoker: "public"` を明示**しています
（認可自体は関数内でログイン必須＋ドメイン制限としてチェックしています）。反映するには再デプロイが必要です:

```bash
pnpm dlx firebase-tools deploy --only functions
```

それでも直らない場合の確認手順:

```bash
# 1) 関数が存在するか・リージョンが asia-northeast1 か
pnpm dlx firebase-tools functions:list

# 2) invoker 権限を手動で付与する
gcloud run services add-iam-policy-binding sendtestnotification \
  --region=asia-northeast1 --project=missions-coorpolate \
  --member=allUsers --role=roles/run.invoker

# 3) 第2世代の関数のログは Cloud Run 側に出るため、
#    firebase functions:log では拾えないことがある
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="sendtestnotification"' \
  --project=missions-coorpolate --limit=20
```

> 組織ポリシーの **ドメイン制限共有（Domain Restricted Sharing）** が有効だと、
> `allUsers` への権限付与がブロックされます。その場合は Google Cloud コンソールの
> 「IAM と管理 > 組織のポリシー」で当該プロジェクトに例外を設定してください。

**その他のエラーと意味**

| クライアントの表示 | 原因 |
|---|---|
| 通知機能が見つかりません | 未デプロイ、またはリージョン不一致 |
| 先に「この端末で通知を有効にする」を実行 | FCM トークンが未登録 |
| 権限がありません | `missions.co.jp` 以外のアカウント |
| 通知機能に接続できませんでした | 未デプロイ / invoker 権限不足（上記参照） |

### ✅ Phase 7 — 削除・ゴミ箱・自動処理 ＋ Node.js 22 ＋ メールダイジェスト

**ゴミ箱（`/trash`・§3.8）**
- 削除済みのタスク・プロジェクト（admin はクライアントも）を一覧し、ワンクリックで復元
- プロジェクトが削除中のタスクは個別復元できない（「先にプロジェクトを復元してください」を表示）
- クライアントは参照整合性のため完全削除の対象外（論理削除のまま保持）

**Cloud Functions（自動処理）**

| 関数 | 種類 | 内容 |
|---|---|---|
| `onProjectWritten` | Firestore トリガー | ①プロジェクトの削除/復元を配下タスクへ連動 ②公開範囲変更時の自動追従（境界ルール3） |
| `purgeTrash` | スケジュール（毎日 4:00 JST） | 削除から **30日** 経過したタスク・プロジェクトを完全削除（コメント・添付メタ・**Storage 実体**含む） |

- 連動削除されたタスクには `deletedByProject` マーカーを付け、**プロジェクト復元時は連動削除分だけを復元**する
  （プロジェクト削除より前に個別削除されていたタスクは復元しない）
- 公開範囲の自動追従: プロジェクトを狭めたとき、**はみ出すタスクだけ**をプロジェクトと同じ範囲へ収める。
  範囲内に収まっている個別設定はそのまま維持（§3.3 の確定仕様どおり）
- 判定ロジックは `functions/src/shared/visibility.ts`。アプリ側 `lib/access/visibility.ts` と
  **全組み合わせで一致することを単体テストで固定**（`tests/unit/visibilityParity.test.ts`）
- purge 用の複合インデックス（`isDeleted` + `deletedAt`）を `firestore.indexes.json` に追加

**ランタイム**
- Cloud Functions を **Node.js 22** に更新（Node 20 は 2026-10-30 廃止予定のため）

**デイリーダイジェスト（メール）**
- 毎朝 9:00 JST のバッチ（`dailyDueReminder`）がプッシュリマインドに加えて送信
- **担当者ごとに 1 通**。未完了タスクを「期日超過／本日期日／期日まで2日以内」に分けて一覧（テキスト + HTML）
- **対象がゼロの人には送らない**
- 送信は Gmail SMTP（Nodemailer）。認証情報はコードに置かず:
  - `GMAIL_SMTP_USER` … `functions/.env`（`functions/.env.example` をコピー）
  - `GMAIL_SMTP_PASSWORD` … **Secret Manager** で管理
- **未設定の場合はメールだけをスキップ**して警告ログを残す（プッシュ通知には影響しない）

#### ダイジェストメールの設定手順
```bash
# 1) 送信元アドレスを設定
cp functions/.env.example functions/.env   # GMAIL_SMTP_USER を記入

# 2) Gmail の「アプリ パスワード」を Secret Manager に登録
#    （送信元アカウントで 2 段階認証を有効化 → https://myaccount.google.com/apppasswords で発行）
pnpm dlx firebase-tools functions:secrets:set GMAIL_SMTP_PASSWORD

# 3) デプロイ
pnpm dlx firebase-tools deploy --only functions,firestore:indexes
```

> Gmail は通常のパスワードでは SMTP 認証できません。必ず**アプリ パスワード**を使ってください。
> Secret 未登録のままデプロイすると CLI が対話的に値の入力を求めます。

現在のテスト数: **単体 47 / ルール 62**

### ✅ Phase 8 — 仕上げ

**メンバー管理（`/members`・Admin 限定）**
- 全メンバーの一覧（名前・メール・登録日）とロール変更（管理者／PM／メンバー）
- **最後の管理者は降格不可**（UI で保護。誰も権限管理できなくなる事故を防ぐ）
- 「自分」「初期管理者」バッジ、ロールごとの権限説明（§3.2）を併記
- 招待の案内: `missions.co.jp` アカウントでログインすれば自動的にメンバー登録されるため、
  **招待はアプリの URL を共有するだけ**。必要に応じてこの画面でロールを引き上げる
- ルール変更（admin のみ・自己昇格不可）は Phase 2 実装のルール + テストで担保済み

**エラーハンドリング・仕上げ**
- 404 ページ（`app/not-found.tsx`）とエラーバウンダリ（`app/error.tsx`・再試行導線つき）
- favicon（`app/icon.png`）
- 各一覧の空状態・ローディング・エラー表示は各フェーズで実装済み

**README 最終化**
- デプロイ手順をランブック化（初回セットアップ／通常デプロイ／動作確認チェックリスト）

---

## 運用メモ

- **通知が届かないとき**: `/settings` の許可状態バッジとテスト送信で切り分け（§「通知が動かないときの切り分け」参照）
- **新メンバーの追加**: アプリ URL を共有 → 本人が Google ログイン → 必要なら `/members` でロール変更
- **ゴミ箱**: 削除から 30 日で完全削除（毎日 4:00 JST のバッチ）。それまでは `/trash` から復元可能
- **毎朝 9:00 JST**: 期日リマインド（プッシュ）+ デイリーダイジェスト（メール）が自動実行
- **コスト**: Cloud Functions は最小インスタンス 0・maxInstances 10。Cloud Scheduler 2 ジョブ。
  Blaze プランの予算アラートを設定済みであること
