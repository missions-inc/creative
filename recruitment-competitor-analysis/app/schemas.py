"""構造化出力用のデータモデル"""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

SalaryUnit = Literal["時給", "日給", "月給", "年収", "不明"]
SourceMedia = Literal["Indeed", "ジョブメドレー", "ハローワーク"]


class ClientJob(BaseModel):
    """クライアント求人票から抽出する情報"""

    company: str = Field(description="施設・企業名。記載がなければ空文字")
    job_title: str = Field(description="募集職種名（例: 保育士、正看護師、介護職員）")
    job_category: str = Field(description="職種の一般的な分類名。競合検索に使いやすい語（例: 保育士、児童発達支援管理責任者）")
    employment_type: str = Field(description="雇用形態（正社員/パート・アルバイト/契約社員 など）")
    prefecture: str = Field(description="勤務地の都道府県（例: 神奈川県）")
    city: str = Field(description="勤務地の市区町村（例: 横浜市青葉区）。不明なら空文字")
    salary_min: Optional[int] = Field(description="提示給与の下限（円、数値のみ。月給25万円なら250000）")
    salary_max: Optional[int] = Field(description="提示給与の上限（円）。単一提示なら下限と同額")
    salary_unit: SalaryUnit = Field(description="給与の単位")
    pr_points: List[str] = Field(description="求人のPRポイント・アピール要素の箇条書き")
    benefits: List[str] = Field(description="福利厚生・制度の箇条書き")
    work_hours: str = Field(description="勤務時間の記載。不明なら空文字")
    notes: str = Field(description="その他、競合比較に有用な補足。なければ空文字")


class CompetitorJob(BaseModel):
    """競合求人1件分"""

    company: str = Field(description="企業・事業所名")
    title: str = Field(description="求人タイトルまたは募集職種名")
    employment_type: str = Field(description="雇用形態")
    location: str = Field(description="勤務地（市区町村まで）")
    salary_text: str = Field(description="給与の原文表記（例: 月給23万円〜28万円）")
    salary_min: Optional[int] = Field(description="給与下限（円、数値）。不明ならnull")
    salary_max: Optional[int] = Field(description="給与上限（円、数値）。不明ならnull")
    salary_unit: SalaryUnit = Field(description="給与の単位")
    pr_points: List[str] = Field(description="その求人のPRポイント")
    benefits: List[str] = Field(description="福利厚生・制度")
    source_media: SourceMedia = Field(description="掲載媒体")
    updated_date: Optional[str] = Field(description="求人の更新日・掲載日（YYYY-MM-DD）。不明ならnull")
    url: str = Field(description="求人ページのURL")


class CompetitorResult(BaseModel):
    """競合求人検索の結果"""

    jobs: List[CompetitorJob] = Field(description="収集した競合求人")
    min_wage_hourly: Optional[int] = Field(
        description="Web検索で確認した対象都道府県の最新の地域別最低賃金（円/時）。確認できなければnull"
    )
    min_wage_source: str = Field(description="最低賃金の確認元（URLや資料名）。確認できなければ空文字")
    notes: str = Field(description="検索過程での補足事項（見つかりにくかった等）。なければ空文字")


class SalarySample(BaseModel):
    """給与相場算出用のサンプル1件"""

    label: str = Field(description="求人の識別ラベル（企業名や求人タイトルの要約）")
    location: str = Field(description="勤務地（市区町村まで）")
    salary_min: int = Field(description="給与下限（円、数値）")
    salary_max: Optional[int] = Field(description="給与上限（円、数値）。単一提示ならnull")
    salary_unit: SalaryUnit = Field(description="給与の単位")
    source_media: SourceMedia = Field(description="掲載媒体")
    url: str = Field(description="出典URL。一覧ページの場合は一覧ページのURL")


class MarketResult(BaseModel):
    """給与相場スイープの結果"""

    samples: List[SalarySample] = Field(description="収集した給与サンプル")
    notes: str = Field(description="収集方法・カバレッジに関する補足。なければ空文字")
