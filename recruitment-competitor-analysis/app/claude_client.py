"""Claude API 呼び出しの共通処理

- run_search_task: web_search ツール付きの検索タスクを実行（pause_turn を自動継続）
- extract_structured: テキストから構造化データを抽出（messages.parse）
"""

from typing import Type, TypeVar

import anthropic
from pydantic import BaseModel

from .config import ALLOWED_DOMAINS, MODEL

T = TypeVar("T", bound=BaseModel)

MAX_CONTINUATIONS = 6  # pause_turn の自動継続回数の上限


def get_client() -> anthropic.Anthropic:
    """ANTHROPIC_API_KEY 環境変数（または ant auth プロファイル）から認証"""
    return anthropic.Anthropic()


def run_search_task(
    client: anthropic.Anthropic,
    system: str,
    user_prompt: str,
    max_searches: int,
    max_tokens: int = 16000,
) -> str:
    """web_search ツールを使う調査タスクを実行し、最終テキストを返す"""
    tools = [
        {
            "type": "web_search_20260209",
            "name": "web_search",
            "max_uses": max_searches,
            "allowed_domains": ALLOWED_DOMAINS,
            "user_location": {
                "type": "approximate",
                "country": "JP",
                "timezone": "Asia/Tokyo",
            },
        }
    ]
    messages = [{"role": "user", "content": user_prompt}]

    response = None
    for _ in range(MAX_CONTINUATIONS + 1):
        with client.messages.stream(
            model=MODEL,
            max_tokens=max_tokens,
            system=system,
            thinking={"type": "adaptive"},
            tools=tools,
            messages=messages,
        ) as stream:
            response = stream.get_final_message()

        # サーバー側ツールの反復上限に達した場合は自動で継続する
        if response.stop_reason == "pause_turn":
            messages = messages + [{"role": "assistant", "content": response.content}]
            continue
        break

    if response is None:
        raise RuntimeError("検索タスクの実行に失敗しました")

    return "".join(block.text for block in response.content if block.type == "text")


def extract_structured(
    client: anthropic.Anthropic,
    instruction: str,
    source_text: str,
    output_format: Type[T],
    max_tokens: int = 8000,
) -> T:
    """テキストからスキーマに沿った構造化データを抽出する"""
    response = client.messages.parse(
        model=MODEL,
        max_tokens=max_tokens,
        messages=[
            {
                "role": "user",
                "content": f"{instruction}\n\n<対象テキスト>\n{source_text}\n</対象テキスト>",
            }
        ],
        output_format=output_format,
    )
    if response.parsed_output is None:
        raise RuntimeError("構造化データの抽出に失敗しました")
    return response.parsed_output
