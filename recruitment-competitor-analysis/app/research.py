"""ステージ2・3: Web検索による競合求人の収集と給与相場スイープ

いずれも2段階で実行する:
  1. web_search ツール付きの調査タスク（Indeed / ジョブメドレー / ハローワークにドメイン限定）
  2. 調査レポートのテキストから構造化データを抽出
"""

from datetime import date

import anthropic

from .claude_client import extract_structured, run_search_task
from .config import (
    COMPETITOR_COUNT,
    COMPETITOR_MAX_SEARCHES,
    FRESHNESS_DAYS,
    MARKET_MAX_SEARCHES,
    MARKET_SAMPLE_TARGET,
)
from .schemas import ClientJob, CompetitorResult, MarketResult

_SEARCH_SYSTEM = """あなたは日本の採用市場に詳しいリサーチャーです。
求人情報の検索には Indeed（indeed.com）、ジョブメドレー（job-medley.com）、
ハローワーク（kyujin.hellowork.mhlw.go.jp）の3媒体のみを使用します。
給与・更新日・URLなどの事実は検索結果に基づいて正確に報告し、推測で補わないでください。
検索クエリは日本語で、職種名 × 地名 × 媒体名（site指定含む）を組み合わせて工夫してください。"""


def _client_summary(job: ClientJob) -> str:
    salary = "不明"
    if job.salary_min:
        salary = f"{job.salary_unit} {job.salary_min:,}円"
        if job.salary_max and job.salary_max != job.salary_min:
            salary += f"〜{job.salary_max:,}円"
    return (
        f"- 職種: {job.job_title}（分類: {job.job_category}）\n"
        f"- 雇用形態: {job.employment_type}\n"
        f"- 勤務地: {job.prefecture}{job.city}\n"
        f"- 提示給与: {salary}"
    )


def find_competitors(
    client: anthropic.Anthropic, job: ClientJob, today: date
) -> CompetitorResult:
    """競合となりそうな求人を約5件収集する"""
    prompt = f"""クライアントの求人と採用競合になりそうな求人を調査してください。

<クライアント求人>
{_client_summary(job)}
</クライアント求人>

調査タスク（本日: {today.isoformat()}）:

1. 同職種（{job.job_category}）・同一または近隣エリア（{job.prefecture}{job.city}を中心に同市内・同区内を優先）で、
   競合となりそうな求人を {COMPETITOR_COUNT}件程度 見つける。
   - 3媒体（Indeed / ジョブメドレー / ハローワーク）から探し、可能なら媒体が偏らないようにする
   - 雇用形態はクライアントと同じもの（{job.employment_type}）を優先する
   - 各求人について: 企業名 / 求人タイトル / 雇用形態 / 勤務地 / 給与（原文表記と数値） /
     PRポイント / 福利厚生・制度 / 掲載媒体 / 更新日・掲載日 / URL を記録する
   - 更新日・掲載日が {FRESHNESS_DAYS}日以上前の古い求人は候補から外す（更新日は必ず確認を試みる）

2. {job.prefecture}の最新の地域別最低賃金（円/時）を厚生労働省の情報で確認し、金額と確認元を記録する。

最後に、収集した全情報を漏れなく整理したレポートを日本語で出力してください。
各求人のURL・更新日・給与数値は省略せず明記してください。"""

    report = run_search_task(
        client, _SEARCH_SYSTEM, prompt, max_searches=COMPETITOR_MAX_SEARCHES
    )

    instruction = f"""以下の調査レポートから、競合求人の情報を構造化データとして抽出してください。
- 給与は円の数値に変換する（月給23万円 → 230000）
- レポートに記載のない項目は null / 空文字とし、推測で補わない
- 更新日は YYYY-MM-DD 形式（本日は {today.isoformat()}。「3日前に更新」等の相対表記は日付に換算する）"""

    return extract_structured(client, instruction, report, CompetitorResult)


def sweep_market_salaries(
    client: anthropic.Anthropic, job: ClientJob, today: date
) -> MarketResult:
    """同職種・近隣エリアの給与サンプルを約100件収集する"""
    prompt = f"""給与相場の算出のため、求人の給与データを大量に収集してください。

<対象条件>
- 職種: {job.job_category}
- エリア: {job.prefecture}{job.city} を中心に、同市内・同区内 → 近隣市区 の優先順位
- 雇用形態: {job.employment_type} を優先（同職種であれば他形態も可、ただし単位を正確に記録）
</対象条件>

調査タスク（本日: {today.isoformat()}）:
- Indeed / ジョブメドレー / ハローワークの検索結果一覧ページには多数の求人の給与が表示されます。
  一覧ページを活用して効率よく、合計 {MARKET_SAMPLE_TARGET}件程度 の給与データを収集してください。
- 1件ごとに: 識別ラベル（企業名 or タイトル要約） / 勤務地 / 給与下限 / 給与上限 / 単位（時給・日給・月給・年収） / 媒体 / URL（一覧ページのURLで可）
- 同一求人の重複はカウントしない。給与が「非公開」「応相談」のものは含めない。
- 明らかに古い求人（更新が{FRESHNESS_DAYS}日以上前と判明したもの）は含めない。

最後に、収集した給与データを全件、漏れなく一覧化したレポートを日本語で出力してください。
（後工程で機械抽出するため、途中で「〜など多数」と省略せず、把握できた件数分をすべて書き出すこと）"""

    report = run_search_task(
        client,
        _SEARCH_SYSTEM,
        prompt,
        max_searches=MARKET_MAX_SEARCHES,
        max_tokens=32000,
    )

    instruction = """以下の調査レポートから、給与サンプルを1件ずつ構造化データとして抽出してください。
- 給与は円の数値に変換する（時給1,200円 → 1200 / 月給23.5万円 → 235000）
- レポートに記載された全サンプルを抽出し、省略しない
- 単位が判別できないサンプルは「不明」とする"""

    return extract_structured(
        client, instruction, report, MarketResult, max_tokens=32000
    )
