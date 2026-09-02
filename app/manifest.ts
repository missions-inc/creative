import type { MetadataRoute } from "next";

/**
 * Web App Manifest（PWA）。
 *
 * 通知の表示名対策（§3.10 補足）:
 * Chrome の通知には送信元サイトが表示される。未インストールの場合はオリジン
 * （例: missions-coorpolate.web.app）が出るが、このマニフェストを持つサイトを
 * PWA としてインストールすると、通知は「タスク管理」というアプリ名で表示される。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "タスク管理",
    short_name: "タスク管理",
    description: "クライアント別・プロジェクト別のタスク管理アプリ",
    lang: "ja",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
