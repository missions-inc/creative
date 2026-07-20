"""CLIエントリポイント

使い方:
    python -m app --input samples/sample_job.txt --output report.xlsx
"""

import argparse
import sys
from datetime import date
from pathlib import Path

from .claude_client import get_client
from .filters import compute_stats, filter_competitors, filter_samples, resolve_min_wage
from .parser import parse_client_job
from .report import build_report
from .research import find_competitors, sweep_market_salaries


def main() -> int:
    ap = argparse.ArgumentParser(
        prog="python -m app",
        description="クライアント求人票から競合求人と給与相場を自動調査し、Excelレポートを出力します。",
    )
    ap.add_argument("--input", "-i", required=True, help="クライアント求人票のテキストファイル")
    ap.add_argument("--output", "-o", default=None,
                    help="出力するExcelファイルのパス（省略時: 競合分析レポート_YYYYMMDD.xlsx）")
    args = ap.parse_args()

    job_text = Path(args.input).read_text(encoding="utf-8")
    today = date.today()
    output = args.output or f"競合分析レポート_{today.strftime('%Y%m%d')}.xlsx"

    client = get_client()

    print("① 求人票を解析しています...")
    job = parse_client_job(client, job_text)
    print(f"   職種: {job.job_title} ／ エリア: {job.prefecture}{job.city} ／ "
          f"給与: {job.salary_unit} {job.salary_min or '?'}〜{job.salary_max or '?'}円")

    print("② 競合求人を検索しています（Indeed / ジョブメドレー / ハローワーク）...")
    comp_result = find_competitors(client, job, today)
    print(f"   候補 {len(comp_result.jobs)}件を取得")

    min_wage = resolve_min_wage(
        job.prefecture, comp_result.min_wage_hourly, comp_result.min_wage_source
    )
    print(f"   最低賃金: {min_wage.hourly:,}円/時（{min_wage.source}）")

    competitors, excluded = filter_competitors(comp_result.jobs, min_wage.hourly, today)
    if excluded:
        print(f"   除外 {len(excluded)}件（最低賃金未満・更新30日超）")

    print("③ 給与相場データを収集しています（約100件・数分かかります）...")
    market_result = sweep_market_salaries(client, job, today)
    samples, dropped = filter_samples(market_result.samples, min_wage.hourly)
    print(f"   サンプル {len(samples)}件を採用（除外 {dropped}件）")

    for st in compute_stats(samples):
        print(f"   [{st.unit}] {st.count}件  下限 {st.low:,}円 ／ "
              f"中央値 {st.mid:,.0f}円 ／ 上限 {st.high:,}円")

    print("④ Excelレポートを作成しています...")
    build_report(
        output_path=output,
        client_job=job,
        competitors=competitors,
        excluded=excluded,
        samples=samples,
        dropped_sample_count=dropped,
        min_wage=min_wage,
        today=today,
    )
    print(f"完了: {output}")
    if comp_result.notes:
        print(f"（補足: {comp_result.notes}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
