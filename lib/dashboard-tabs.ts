/**
 * ダッシュボードのタブ定義。
 * URL の /dashboard?tab=<value> と対応し、ページ本体とグローバルメニューの
 * ドロップダウンで共有する。
 */
export const DASHBOARD_TABS = [
  { value: "due-soon", label: "期日間近" },
  { value: "my-tasks", label: "マイタスク" },
  { value: "by-client", label: "クライアント別" },
] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number]["value"];

export function isDashboardTab(v: string | null): v is DashboardTab {
  return v !== null && DASHBOARD_TABS.some((t) => t.value === v);
}

export function dashboardTabHref(tab: DashboardTab): string {
  return `/dashboard?tab=${tab}`;
}
