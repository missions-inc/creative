"""Streamlit UI — 求人票を貼り付けてボタンひとつでレポートを生成する

起動: streamlit run streamlit_app.py
"""

import tempfile
from datetime import date
from pathlib import Path

import streamlit as st

from app.claude_client import get_client
from app.filters import compute_stats, filter_competitors, filter_samples, resolve_min_wage
from app.parser import parse_client_job
from app.report import build_report
from app.research import find_competitors, sweep_market_salaries

st.set_page_config(page_title="採用競合・給与相場 分析ツール", page_icon="📊", layout="wide")
st.title("📊 採用競合・給与相場 分析ツール")
st.caption("クライアント求人票を貼り付けると、Indeed／ジョブメドレー／ハローワークから"
           "競合求人と給与相場を自動調査し、Excelレポートを生成します。")

job_text = st.text_area("クライアント求人票（本文を貼り付け）", height=300,
                        placeholder="求人票のテキストをここに貼り付けてください")

if st.button("分析を実行", type="primary", disabled=not job_text.strip()):
    today = date.today()
    client = get_client()

    with st.status("分析を実行中...", expanded=True) as status:
        st.write("① 求人票を解析しています...")
        job = parse_client_job(client, job_text)
        st.write(f"　職種: **{job.job_title}** ／ エリア: **{job.prefecture}{job.city}**")

        st.write("② 競合求人を検索しています...")
        comp_result = find_competitors(client, job, today)
        min_wage = resolve_min_wage(
            job.prefecture, comp_result.min_wage_hourly, comp_result.min_wage_source
        )
        competitors, excluded = filter_competitors(comp_result.jobs, min_wage.hourly, today)
        st.write(f"　競合求人 {len(competitors)}件を採用（除外 {len(excluded)}件）／ "
                 f"最低賃金 {min_wage.hourly:,}円/時")

        st.write("③ 給与相場データを収集しています（数分かかります）...")
        market_result = sweep_market_salaries(client, job, today)
        samples, dropped = filter_samples(market_result.samples, min_wage.hourly)
        st.write(f"　サンプル {len(samples)}件を採用（除外 {dropped}件）")
        for s in compute_stats(samples):
            st.write(f"　[{s.unit}] {s.count}件 ─ 下限 {s.low:,}円 ／ "
                     f"中央値 {s.mid:,.0f}円 ／ 上限 {s.high:,}円")

        st.write("④ Excelレポートを作成しています...")
        out_path = Path(tempfile.mkdtemp()) / f"競合分析レポート_{today.strftime('%Y%m%d')}.xlsx"
        build_report(
            output_path=str(out_path),
            client_job=job,
            competitors=competitors,
            excluded=excluded,
            samples=samples,
            dropped_sample_count=dropped,
            min_wage=min_wage,
            today=today,
        )
        status.update(label="分析が完了しました", state="complete")

    st.download_button(
        "📥 Excelレポートをダウンロード",
        data=out_path.read_bytes(),
        file_name=out_path.name,
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        type="primary",
    )
