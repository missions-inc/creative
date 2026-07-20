"""フィルタリングと統計の補助処理

- 最低賃金の解決（Web検索で取得した最新値 ⇔ 同梱フォールバック値）
- 除外ルールの適用:
    1. 最低賃金を下回る求人
    2. 更新日が30日以上前の求人
"""

from dataclasses import dataclass
from datetime import date, datetime
from statistics import median
from typing import List, Optional, Sequence, Tuple

from .config import (
    FRESHNESS_DAYS,
    MONTHS_PER_YEAR,
    STANDARD_DAILY_HOURS,
    STANDARD_MONTHLY_HOURS,
)
from .min_wage import fallback_min_wage
from .schemas import CompetitorJob, SalarySample


@dataclass
class MinWageInfo:
    hourly: int
    source: str


@dataclass
class ExcludedJob:
    job: CompetitorJob
    reason: str


def resolve_min_wage(
    prefecture: str, searched_value: Optional[int], searched_source: str
) -> MinWageInfo:
    """Web検索で得た最低賃金と同梱テーブルを突き合わせ、採用する値を決める。

    テーブル値は過年度の確定値（＝下限として常に正しい）なので、
    検索値がテーブル値未満の場合は誤取得とみなしてテーブル値を使う。
    """
    fallback = fallback_min_wage(prefecture)
    if searched_value and (fallback is None or searched_value >= fallback):
        source = searched_source or "Web検索（厚生労働省）"
        return MinWageInfo(hourly=searched_value, source=f"{source}（実行時に取得）")
    if fallback is not None:
        return MinWageInfo(
            hourly=fallback,
            source="同梱テーブル（厚生労働省 2024年度改定値・フォールバック）",
        )
    # 都道府県が特定できない場合は全国加重平均の下限相当として最小値を使う
    return MinWageInfo(hourly=951, source="同梱テーブル最小値（都道府県未特定）")


def to_hourly(amount: Optional[int], unit: str) -> Optional[float]:
    """給与を時給に概算換算する（最低賃金チェック用）"""
    if amount is None:
        return None
    if unit == "時給":
        return float(amount)
    if unit == "日給":
        return amount / STANDARD_DAILY_HOURS
    if unit == "月給":
        return amount / STANDARD_MONTHLY_HOURS
    if unit == "年収":
        return amount / MONTHS_PER_YEAR / STANDARD_MONTHLY_HOURS
    return None  # 単位不明は換算不能


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def filter_competitors(
    jobs: Sequence[CompetitorJob], min_wage_hourly: int, today: date
) -> Tuple[List[CompetitorJob], List[ExcludedJob]]:
    """除外ルールを適用し、(採用, 除外) に分ける"""
    kept: List[CompetitorJob] = []
    excluded: List[ExcludedJob] = []

    for job in jobs:
        # ルール1: 最低賃金チェック
        # 時給求人のみ厳密に判定する。月給・年収・日給は所定/実働労働時間が
        # 求人ごとに異なり時給換算が不正確なため（例: 月給18万円台の正社員は
        # 介護業界では通常水準で最低賃金違反ではない）、誤除外を避けて対象外とする。
        hourly = to_hourly(job.salary_min, job.salary_unit) if job.salary_unit == "時給" else None
        if hourly is not None and hourly < min_wage_hourly:
            excluded.append(
                ExcludedJob(
                    job=job,
                    reason=(
                        f"最低賃金未満（時給換算 約{hourly:,.0f}円 < "
                        f"最低賃金 {min_wage_hourly:,}円）"
                    ),
                )
            )
            continue

        # ルール2: 更新日チェック（更新日が判明していて30日以上前なら除外）
        updated = _parse_date(job.updated_date)
        if updated is not None and (today - updated).days >= FRESHNESS_DAYS:
            excluded.append(
                ExcludedJob(
                    job=job,
                    reason=f"更新日が{FRESHNESS_DAYS}日以上前（{job.updated_date}）",
                )
            )
            continue

        kept.append(job)

    return kept, excluded


def filter_samples(
    samples: Sequence[SalarySample], min_wage_hourly: int
) -> Tuple[List[SalarySample], int]:
    """相場サンプルから最低賃金未満・単位不明を除外する。戻り値: (採用, 除外件数)"""
    kept: List[SalarySample] = []
    dropped = 0
    for s in samples:
        if s.salary_unit == "不明":
            dropped += 1
            continue
        # 最低賃金チェックは時給求人のみ（月給・年収・日給は時給換算が不正確なため対象外）
        hourly = to_hourly(s.salary_min, s.salary_unit) if s.salary_unit == "時給" else None
        if hourly is not None and hourly < min_wage_hourly:
            dropped += 1
            continue
        kept.append(s)
    return kept, dropped


def representative(sample: SalarySample) -> float:
    """サンプルの代表値（下限と上限の中間。上限がなければ下限）"""
    if sample.salary_max:
        return (sample.salary_min + sample.salary_max) / 2
    return float(sample.salary_min)


@dataclass
class UnitStats:
    category: str  # 雇用区分（正社員／パート）
    unit: str      # 給与単位（時給／月給など）
    count: int
    low: int       # 相場下限 = 各求人の下限給与の最小値
    mid: float     # 中央値 = 各求人の代表値の中央値
    high: int      # 相場上限 = 各求人の上限給与（なければ下限）の最大値


def compute_stats(samples: Sequence[SalarySample]) -> List[UnitStats]:
    """雇用区分×給与単位ごとに相場統計を算出する（画面表示用。
    Excelレポート側では同じ計算を数式で行う）"""
    stats: List[UnitStats] = []
    for category in ("正社員", "パート"):
        for unit in ("時給", "日給", "月給", "年収"):
            group = [
                s for s in samples
                if s.employment_category == category and s.salary_unit == unit
            ]
            if not group:
                continue
            stats.append(
                UnitStats(
                    category=category,
                    unit=unit,
                    count=len(group),
                    low=min(s.salary_min for s in group),
                    mid=median(representative(s) for s in group),
                    high=max((s.salary_max or s.salary_min) for s in group),
                )
            )
    return stats


def client_category(employment_type: str) -> str:
    """クライアントの雇用形態文字列を相場比較用の雇用区分に対応付ける"""
    if any(k in employment_type for k in ("パート", "アルバイト", "非常勤")):
        return "パート"
    return "正社員"
