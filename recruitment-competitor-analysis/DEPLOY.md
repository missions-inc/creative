# Webアプリとして公開する手順（https のURLを発行する）

このアプリは Streamlit 製のため、**Streamlit Community Cloud（無料）** にデプロイすると
`https://〇〇〇.streamlit.app` という形式のURLが発行され、ブラウザからそのまま利用できます。

> ⚠️ デプロイにはGitHubアカウントでのログインが必要なため、以下の操作は
> リポジトリにアクセスできる方（GitHubの missions-inc/creative にアクセス権のある方）が行ってください。
> 所要時間は10分程度です。

## 手順（Streamlit Community Cloud・推奨）

### 1. デプロイ

1. https://share.streamlit.io/ を開き、**「Sign in with GitHub」** でログイン
   - 初回は「Authorize streamlit」の画面が出るので許可します
   - 組織リポジトリ（missions-inc）への許可を求められた場合は
     「Organization access」で missions-inc に **Grant** してください
2. 右上の **「Create app」→「Deploy a public app from GitHub」** を選択
3. 以下を入力:

   | 項目 | 入力値 |
   |---|---|
   | Repository | `missions-inc/creative` |
   | Branch | `main`（またはこのブランチ名） |
   | Main file path | `recruitment-competitor-analysis/streamlit_app.py` |
   | App URL | 好きなサブドメイン名（例: `missions-salary-bench`） |

4. **「Deploy!」** をクリック → 数分でビルドが完了し、
   **`https://missions-salary-bench.streamlit.app`** のようなURLが発行されます

### 2. Secrets の設定（APIキーとパスワード）

発行されたアプリの画面右下 **「Manage app」→「⋮」→「Settings」→「Secrets」** を開き、
以下を貼り付けて保存します:

```toml
# サーバー側にAPIキーを設定（メンバーは入力不要になる）
ANTHROPIC_API_KEY = "sk-ant-xxxxxxxx"

# アプリを開くときのパスワード（社外の人が使えないようにする保護）
APP_PASSWORD = "好きなパスワード"
```

- `ANTHROPIC_API_KEY` を設定すると、利用メンバーはAPIキーを知らなくても使えます
- `APP_PASSWORD` を設定すると、URLを知っていてもパスワードなしでは利用できません
- 保存すると自動で再起動され、すぐ反映されます

### 3. 公開範囲の設定（重要）

Community Cloud のアプリはデフォルトで「URLを知っている人は誰でも閲覧可能」です。
クライアント情報を扱うため、次のどちらか（両方推奨）を行ってください:

- 上記の `APP_PASSWORD` を設定する（簡単・推奨）
- 「Settings」→「Sharing」で **「Only specific people can view this app」** を選び、
  社内メンバーのメールアドレスを招待する

### 4. 社内への共有

発行されたURL（`https://〇〇〇.streamlit.app`）と `APP_PASSWORD` を
社内メンバーに共有すれば完了です。PC・スマホどちらのブラウザでも利用できます。

---

## 運用メモ

- **更新の反映**: リポジトリの対象ブランチにプッシュすると、アプリは自動で再デプロイされます
- **スリープ**: 無料枠では一定期間アクセスがないとアプリがスリープします。
  次にアクセスした人が「Yes, get this app back up!」を押すと数十秒で復帰します
- **リソース**: 無料枠は1アプリ 1GBメモリ程度。本ツールの処理はAPI側で行われるため十分です
- **APIキーの請求**: Secrets に設定したキーの利用料金が会社のAnthropicアカウントに課金されます。
  利用量は https://console.anthropic.com/ で確認できます

## 代替手段

| 方法 | 向いているケース |
|---|---|
| **Hugging Face Spaces**（無料〜） | Streamlit Cloud が使えない場合。Space作成時に SDK=Streamlit を選び、このフォルダの内容をアップロード。Settings → Variables and secrets にAPIキーを設定 |
| **社内サーバで常時起動** | 外部クラウドに置きたくない場合。`streamlit run streamlit_app.py --server.address 0.0.0.0` で起動し、`http://<サーバIP>:8501` を社内共有（httpsが必要なら社内リバースプロキシ配下に） |
