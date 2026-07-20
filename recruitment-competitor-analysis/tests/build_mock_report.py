"""モックデータでExcelレポートを生成する検証スクリプト（API不要）

実行: python tests/build_mock_report.py [出力パス]
"""

import random
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.filters import (  # noqa: E402
    MinWageInfo,
    filter_competitors,
    filter_samples,
)
from app.report import build_report  # noqa: E402
from app.schemas import ClientJob, CompetitorJob, SalarySample  # noqa: E402

TODAY = date(2026, 7, 20)

client_job = ClientJob(
    company="発達こどもアカデミー 青葉台校",
    job_title="保育士（児童発達支援スタッフ）",
    job_category="保育士",
    employment_type="正社員",
    prefecture="神奈川県",
    city="横浜市青葉区",
    salary_min=235000,
    salary_max=280000,
    salary_unit="月給",
    pr_points=["駅徒歩3分", "少人数制（1日定員10名）", "残業月5時間以下", "オープン2年目"],
    benefits=["社会保険完備", "交通費全額支給", "賞与年2回", "研修制度", "産休・育休実績"],
    work_hours="9:30〜18:30（実働8時間）",
    notes="",
)

competitors_raw = [
    CompetitorJob(
        company="モック保育園A", title="保育士（正社員）", employment_type="正社員",
        location="横浜市青葉区", salary_text="月給22万円〜27万円",
        salary_min=220000, salary_max=270000, salary_unit="月給",
        pr_points=["住宅手当あり", "年間休日120日"], benefits=["社会保険完備", "退職金制度"],
        source_media="Indeed", updated_date="2026-07-10",
        url="https://jp.indeed.com/mock-a",
    ),
    CompetitorJob(
        company="モック児童デイB", title="児童指導員・保育士", employment_type="正社員",
        location="横浜市都筑区", salary_text="月給24万円〜30万円",
        salary_min=240000, salary_max=300000, salary_unit="月給",
        pr_points=["インセンティブあり"], benefits=["交通費支給", "資格取得支援"],
        source_media="ジョブメドレー", updated_date="2026-07-15",
        url="https://job-medley.com/mock-b",
    ),
    CompetitorJob(
        company="モック福祉会C", title="保育士", employment_type="正社員",
        location="横浜市青葉区", salary_text="月給21万円〜23万円",
        salary_min=210000, salary_max=230000, salary_unit="月給",
        pr_points=["賞与3.5ヶ月"], benefits=["社宅あり"],
        source_media="ハローワーク", updated_date="2026-07-01",
        url="https://kyujin.hellowork.mhlw.go.jp/mock-c",
    ),
    # ↓ 除外対象: 更新が30日以上前
    CompetitorJob(
        company="モック保育園D（古い求人）", title="保育士", employment_type="正社員",
        location="横浜市青葉区", salary_text="月給25万円",
        salary_min=250000, salary_max=None, salary_unit="月給",
        pr_points=[], benefits=[],
        source_media="Indeed", updated_date="2026-05-01",
        url="https://jp.indeed.com/mock-d",
    ),
    # ↓ 除外対象: 最低賃金未満（時給900円 < 1162円）
    CompetitorJob(
        company="モックデイE（低賃金）", title="保育補助（パート）", employment_type="パート",
        location="横浜市青葉区", salary_text="時給900円",
        salary_min=900, salary_max=None, salary_unit="時給",
        pr_points=[], benefits=[],
        source_media="ハローワーク", updated_date="2026-07-18",
        url="https://kyujin.hellowork.mhlw.go.jp/mock-e",
    ),
]

random.seed(42)
samples_raw = []
for i in range(90):
    lo = random.randrange(205000, 275000, 5000)  # 時給換算で最低賃金を上回る範囲
    samples_raw.append(SalarySample(
        label=f"モック法人{i + 1}", location="横浜市青葉区",
        salary_min=lo, salary_max=lo + random.randrange(20000, 60000, 5000),
        salary_unit="月給", source_media=random.choice(["Indeed", "ジョブメドレー", "ハローワーク"]),
        url="https://jp.indeed.com/mock-list",
    ))
for i in range(12):
    lo = random.randrange(1170, 1500, 10)  # 最低賃金(1162円)以上の範囲
    samples_raw.append(SalarySample(
        label=f"モックパート{i + 1}", location="横浜市青葉区",
        salary_min=lo, salary_max=(lo + 200) if i % 3 else None, salary_unit="時給",
        source_media="ジョブメドレー", url="https://job-medley.com/mock-list",
    ))
# 除外対象になる最低賃金未満サンプル
samples_raw.append(SalarySample(
    label="モック低賃金", location="横浜市青葉区", salary_min=1000, salary_max=None,
    salary_unit="時給", source_media="ハローワーク",
    url="https://kyujin.hellowork.mhlw.go.jp/mock",
))

min_wage = MinWageInfo(hourly=1162, source="モック（神奈川県 2024年度）")
competitors, excluded = filter_competitors(competitors_raw, min_wage.hourly, TODAY)
samples, dropped = filter_samples(samples_raw, min_wage.hourly)

assert len(excluded) == 2, f"除外は2件のはず: {len(excluded)}"
assert dropped == 1, f"サンプル除外は1件のはず: {dropped}"

out = sys.argv[1] if len(sys.argv) > 1 else "mock_report.xlsx"
build_report(
    output_path=out,
    client_job=client_job,
    competitors=competitors,
    excluded=excluded,
    samples=samples,
    dropped_sample_count=dropped,
    min_wage=min_wage,
    today=TODAY,
)
print(f"OK: {out} （競合{len(competitors)}件・除外{len(excluded)}件・サンプル{len(samples)}件）")
