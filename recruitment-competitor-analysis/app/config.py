"""アプリ全体の設定値"""

# 使用モデル
MODEL = "claude-opus-4-8"

# 有効な求人媒体（この3媒体のみをソースとして許可する）
ALLOWED_DOMAINS = [
    "indeed.com",        # Indeed（jp.indeed.com 等のサブドメインを含む）
    "job-medley.com",    # ジョブメドレー
    "mhlw.go.jp",        # ハローワーク（kyujin.hellowork.mhlw.go.jp）+ 最低賃金の公式情報
]

# 求人情報の鮮度: 更新日がこの日数より古いものは除外
FRESHNESS_DAYS = 30

# 収集する競合求人の件数目安
COMPETITOR_COUNT = 5

# 給与相場の収集サンプル数目安
MARKET_SAMPLE_TARGET = 100

# 月給→時給換算に使う月平均所定労働時間（週40h × 52週 ÷ 12ヶ月 ≒ 173.8h）
# ※最低賃金チェックおよびレポートの時給換算列で使用。レポート上にも明記される。
STANDARD_MONTHLY_HOURS = 173.8

# 日給→時給換算に使う1日の所定労働時間
STANDARD_DAILY_HOURS = 8

# 年収→月給換算（賞与を含む可能性があるため12分割は概算）
MONTHS_PER_YEAR = 12

# Web検索の上限回数
COMPETITOR_MAX_SEARCHES = 12
MARKET_MAX_SEARCHES = 25
