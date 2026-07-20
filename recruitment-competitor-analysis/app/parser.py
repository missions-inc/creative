"""ステージ1: クライアント求人票の構造化解析"""

import anthropic

from .claude_client import extract_structured
from .schemas import ClientJob

_INSTRUCTION = """あなたは採用コンサルタントのアシスタントです。
以下のクライアント求人票を読み、競合分析に必要な情報を抽出してください。

抽出ルール:
- 給与は必ず「円」の数値に変換する（例: 月給23万円〜28万円 → salary_min=230000, salary_max=280000, salary_unit=月給）
- 複数の雇用形態・給与パターンがある場合は、主たる募集（最初に記載されたもの、または正社員）を対象とする
- PRポイントは応募者への訴求要素（例: 残業少なめ、駅チカ、オープニング、研修充実）を抽出する
- 福利厚生・制度は手当・休暇・保険・研修制度などを抽出する
- 記載がない項目は推測せず、空文字または null とする（都道府県のみ、市区町村名から確実に特定できる場合は補完してよい）"""


def parse_client_job(client: anthropic.Anthropic, job_text: str) -> ClientJob:
    return extract_structured(client, _INSTRUCTION, job_text, ClientJob)
