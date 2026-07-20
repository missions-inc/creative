"""ブラウザUI（Streamlit）— 求人票を貼り付けてボタンひとつでレポートを生成する

起動:
    streamlit run streamlit_app.py

チーム内で共有する場合（社内ネットワークの他PCからアクセス可能にする）:
    streamlit run streamlit_app.py --server.address 0.0.0.0 --server.port 8501
"""

import io
import os
import traceback
from datetime import date

import anthropic
import streamlit as st

from app.config import MARKET_SEGMENTS, SEGMENT_SAMPLE_TARGET
from app.filters import (
    compute_stats,
    filter_competitors,
    filter_samples,
    resolve_min_wage,
)
from app.parser import parse_client_job
from app.report import build_report
from app.research import find_competitors, sweep_market_segment

st.set_page_config(page_title="採用競合・給与相場 分析ツール", page_icon="📊", layout="wide")


def _secret(name: str) -> str:
    """st.secrets から値を取得する（secrets.toml が無い環境でも安全に空文字を返す）"""
    try:
        return str(st.secrets.get(name, "") or "")
    except Exception:
        return ""


# ---------------------------------------------------------------- パスワード保護
# クラウド公開時は Secrets に APP_PASSWORD を設定すると、社内メンバーのみ
# 利用できる簡易パスワードゲートが有効になる（未設定ならゲートなし）
_app_password = _secret("APP_PASSWORD")
if _app_password and not st.session_state.get("auth_ok"):
    st.title("🔒 採用競合・給与相場 分析ツール")
    pw = st.text_input("アプリパスワード", type="password")
    if st.button("ログイン", type="primary"):
        if pw == _app_password:
            st.session_state["auth_ok"] = True
            st.rerun()
        else:
            st.error("パスワードが違います。")
    st.stop()

# ---------------------------------------------------------------- サイドバー
_preset_key = _secret("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_API_KEY", "")

with st.sidebar:
    st.header("⚙️ 設定")
    if _preset_key:
        st.success("APIキーは設定済みです（管理者設定）")
        api_key_input = ""
    else:
        api_key_input = st.text_input(
            "Anthropic APIキー",
            type="password",
            help="管理者がサーバー側で設定済みの場合は入力不要です",
        )
    st.divider()
    st.markdown(
        f"""**処理内容**
1. 求人票の解析
2. 競合求人の収集（約5件）
3. 給与相場の収集
   - 正社員 約{SEGMENT_SAMPLE_TARGET}件（月給相場）
   - パート 約{SEGMENT_SAMPLE_TARGET}件（時給相場）
4. 除外ルールの適用
   - 最低賃金未満
   - 更新日が30日以上前
5. Excelレポート生成

**対象媒体**: Indeed／ジョブメドレー／ハローワーク

⏱️ 所要時間: 5〜15分程度
"""
    )

st.title("📊 採用競合・給与相場 分析ツール")
st.caption(
    "クライアント求人票を貼り付けると、Indeed／ジョブメドレー／ハローワークから"
    "競合求人と給与相場（正社員=月給／パート=時給）を自動調査し、Excelレポートを生成します。"
)

job_text = st.text_area(
    "クライアント求人票（本文を貼り付け）",
    height=280,
    placeholder="求人票のテキストをここに貼り付けてください（職種・勤務地・給与が含まれていること）",
)

run = st.button("🔍 分析を実行", type="primary", disabled=not job_text.strip())


def _get_client() -> anthropic.Anthropic:
    # 優先順位: サイドバー入力 > Secrets（クラウド管理者設定） > 環境変数
    key = api_key_input.strip() or _preset_key
    if not key:
        st.error("Anthropic APIキーが設定されていません。サイドバーに入力するか、"
                 "Secrets／環境変数 ANTHROPIC_API_KEY を設定してください。")
        st.stop()
    return anthropic.Anthropic(api_key=key)


def _run_pipeline(text: str) -> dict:
    today = date.today()
    client = _get_client()

    progress = st.progress(0, text="① 求人票を解析しています...")
    job = parse_client_job(client, text)
    progress.progress(15, text="② 競合求人を検索しています（Indeed／ジョブメドレー／ハローワーク）...")

    comp_result = find_competitors(client, job, today)
    min_wage = resolve_min_wage(
        job.prefecture, comp_result.min_wage_hourly, comp_result.min_wage_source
    )
    competitors, excluded = filter_competitors(comp_result.jobs, min_wage.hourly, today)

    raw_samples = []
    base = 40
    for i, segment in enumerate(MARKET_SEGMENTS):
        progress.progress(
            base + i * 25,
            text=f"③ 給与相場を収集しています（{segment}・約{SEGMENT_SAMPLE_TARGET}件）..."
        )
        result = sweep_market_segment(client, job, today, segment)
        raw_samples.extend(result.samples)

    samples, dropped = filter_samples(raw_samples, min_wage.hourly)
    stats = compute_stats(samples)

    progress.progress(92, text="④ Excelレポートを作成しています...")
    buf = io.BytesIO()
    build_report(
        output_path=buf,
        client_job=job,
        competitors=competitors,
        excluded=excluded,
        samples=samples,
        dropped_sample_count=dropped,
        min_wage=min_wage,
        today=today,
    )
    progress.progress(100, text="✅ 分析が完了しました")

    return {
        "job": job,
        "competitors": competitors,
        "excluded": excluded,
        "samples": samples,
        "dropped": dropped,
        "stats": stats,
        "min_wage": min_wage,
        "notes": comp_result.notes,
        "xlsx": buf.getvalue(),
        "filename": f"競合分析レポート_{today.strftime('%Y%m%d')}.xlsx",
    }


if run:
    try:
        st.session_state["result"] = _run_pipeline(job_text)
    except anthropic.AuthenticationError:
        st.error("APIキーが無効です。サイドバーのAPIキーを確認してください。")
    except Exception:
        st.error("分析中にエラーが発生しました。時間をおいて再実行してください。")
        with st.expander("エラー詳細"):
            st.code(traceback.format_exc())

# ---------------------------------------------------------------- 結果表示
result = st.session_state.get("result")
if result:
    job = result["job"]
    st.success(
        f"分析完了: **{job.job_title}**（{job.prefecture}{job.city}）｜ "
        f"競合求人 {len(result['competitors'])}件（除外 {len(result['excluded'])}件）｜ "
        f"相場サンプル {len(result['samples'])}件（除外 {result['dropped']}件）｜ "
        f"最低賃金 {result['min_wage'].hourly:,}円/時"
    )

    st.download_button(
        "📥 Excelレポートをダウンロード",
        data=result["xlsx"],
        file_name=result["filename"],
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        type="primary",
    )

    tab1, tab2, tab3 = st.tabs(["💰 給与相場", "🏢 競合求人", "🚫 除外した求人"])

    with tab1:
        if result["stats"]:
            st.dataframe(
                [
                    {
                        "雇用区分": s.category,
                        "給与単位": s.unit,
                        "件数": s.count,
                        "相場下限": f"{s.low:,}円",
                        "相場中央値": f"{s.mid:,.0f}円",
                        "相場上限": f"{s.high:,}円",
                    }
                    for s in result["stats"]
                ],
                use_container_width=True,
                hide_index=True,
            )
        else:
            st.warning("相場サンプルを取得できませんでした。")

    with tab2:
        if result["competitors"]:
            st.dataframe(
                [
                    {
                        "媒体": c.source_media,
                        "企業・事業所名": c.company,
                        "職種": c.title,
                        "雇用形態": c.employment_type,
                        "勤務地": c.location,
                        "給与": c.salary_text,
                        "更新日": c.updated_date or "不明",
                        "URL": c.url,
                    }
                    for c in result["competitors"]
                ],
                use_container_width=True,
                hide_index=True,
            )
        else:
            st.warning("採用条件を満たす競合求人が見つかりませんでした。")

    with tab3:
        if result["excluded"]:
            st.dataframe(
                [
                    {
                        "媒体": e.job.source_media,
                        "企業・事業所名": e.job.company,
                        "給与": e.job.salary_text,
                        "除外理由": e.reason,
                    }
                    for e in result["excluded"]
                ],
                use_container_width=True,
                hide_index=True,
            )
        else:
            st.info("除外された求人はありません。")

    if result["notes"]:
        st.caption(f"補足: {result['notes']}")
