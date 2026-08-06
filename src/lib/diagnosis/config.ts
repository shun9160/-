/**
 * 診断の「数字の決め事」を全部ここに集める。
 *
 * 閾値やウェイトをロジックの中に散らすと、
 * 後で調整したときに過去の結果を再現できなくなる。
 * 変更するときは必ず SCORING_VERSION を上げること。
 */

import type { TypeId } from './types'

export const DIAGNOSIS_VERSION = '1.0.0'
export const QUESTION_VERSION = '1.0.0'
export const SCORING_VERSION = '1.0.0'

// ---------------------------------------------------------------
// アンケートと取引データの配分
// ---------------------------------------------------------------

export interface StatusRule {
  /** この件数以上で適用 */
  minTrades: number
  status: 'questionnaire_only' | 'provisional' | 'data_backed'
  questionnaireWeight: number
  behaviorWeight: number
}

/** 上から順に見て、最初に当てはまったものを使う */
export const STATUS_RULES: StatusRule[] = [
  { minTrades: 20, status: 'data_backed', questionnaireWeight: 0.35, behaviorWeight: 0.65 },
  { minTrades: 5, status: 'provisional', questionnaireWeight: 0.65, behaviorWeight: 0.35 },
  { minTrades: 0, status: 'questionnaire_only', questionnaireWeight: 1, behaviorWeight: 0 },
]

/**
 * 取れた指標のウェイト合計がこれを下回るタイプは、
 * 取引データスコアを使わずアンケートだけで判断する。
 */
export const MIN_AVAILABLE_WEIGHT = 0.5

// ---------------------------------------------------------------
// 1位と2位の差による見せ方
// ---------------------------------------------------------------

export const DISPLAY_GAP = {
  /** これ以上離れていれば1位だけを強く出す */
  strong: 8,
  /** これ以上離れていれば2位を「サブ傾向」として添える */
  sub: 3,
}

// ---------------------------------------------------------------
// 信頼度
// ---------------------------------------------------------------

export const CONFIDENCE_LABELS: { min: number; label: string }[] = [
  { min: 85, label: '取引データに基づく明確な傾向' },
  { min: 70, label: '信頼度の高い結果' },
  { min: 40, label: '暫定タイプ' },
  { min: 0, label: '参考結果' },
]

/** 信頼度の内訳。合計が1になるようにする */
export const CONFIDENCE_WEIGHTS = {
  /** 回答した質問の数 */
  answered: 0.2,
  /** 回答の一貫性 */
  consistency: 0.15,
  /** 取引数 */
  tradeCount: 0.2,
  /** 取引の期間の長さ */
  span: 0.1,
  /** 必要な取引データ項目がどれだけ取れたか */
  coverage: 0.15,
  /** 1位と2位の差 */
  gap: 0.1,
  /** 直近データの新しさ */
  freshness: 0.1,
}

export const CONFIDENCE_SCALES = {
  /** 取引件数: この件数で満点 */
  tradeCountFull: 60,
  /** 取引期間(日): この日数で満点 */
  spanDaysFull: 90,
  /** 1位2位の差: この差で満点 */
  gapFull: 15,
  /** 最終取引からの経過日数: これを超えると0点 */
  staleDays: 45,
}

// ---------------------------------------------------------------
// 取引データスコアの閾値
// ---------------------------------------------------------------

export const THRESHOLDS = {
  /** 1日あたり取引数（少ない〜多い） */
  tradesPerDay: { low: 1, high: 6 },
  /** 平均保有時間(分)（短い〜長い） */
  holdMinutes: { low: 15, high: 480 },
  /** 平均計画RR */
  plannedRR: { low: 1, high: 3 },
  /** 1取引あたりリスク率(%) */
  riskPct: { low: 0.5, high: 5 },
  /** 最大ドローダウン率(%) */
  drawdownPct: { low: 2, high: 25 },
  /** リカバリーファクター（純損益 ÷ 最大DD） */
  recoveryFactor: { low: 0, high: 3 },
  /** 実損失が計画内と見なす余裕 (10%まで) */
  lossOverrun: 1.1,
  /** 「損失直後の再エントリー」と見なす分数 */
  revengeMinutes: 15,
  /** 分散度の判定に使う、銘柄あたりの最低取引数 */
  minTradesPerBucket: 3,
  /** 改善傾向の比較期間(日) */
  trendWindowDays: 30,
}

// ---------------------------------------------------------------
// タイプごとの取引データ指標のウェイト
//
// 仕様書のウェイトをそのまま持つ。
// このアプリが取れない指標（戦略タグなど）は behavior.ts 側で
// score=null になり、残りのウェイトで再正規化される。
// ---------------------------------------------------------------

export const BEHAVIOR_WEIGHTS: Record<TypeId, Record<string, number>> = {
  BLAZE: {
    tradesPerDay: 0.3,
    shortHold: 0.2,
    plannedRR: 0.2,
    momentumTagRate: 0.2,
    executionRate: 0.1,
  },
  LOGIC: {
    slTpRate: 0.25,
    journalRate: 0.25,
    riskConsistency: 0.25,
    setupTagConsistency: 0.25,
  },
  GUARD: {
    slRate: 0.25,
    lowRiskPct: 0.25,
    lowDrawdown: 0.25,
    lossWithinPlan: 0.25,
  },
  SHIFT: {
    strategyEntropy: 0.3,
    sessionEntropy: 0.2,
    symbolEntropy: 0.2,
    multiContextProfit: 0.3,
  },
  WATCH: {
    fewTradesPerDay: 0.2,
    winRate: 0.2,
    slTpRate: 0.2,
    noRevenge: 0.2,
    planNoteRate: 0.2,
  },
  RISE: {
    recoveryFactor: 0.25,
    afterLossDiscipline: 0.25,
    lossJournalRate: 0.25,
    improvementTrend: 0.25,
  },
}

// ---------------------------------------------------------------
// 再診断のおすすめ条件
// ---------------------------------------------------------------

export const RECHECK = {
  /** 前回からこの件数増えたら再診断をすすめる */
  newTrades: 20,
  /** 前回からこの日数たったら再診断をすすめる */
  days: 30,
  /** 主要タイプのスコアがこれ以上動いたら再診断をすすめる */
  scoreShift: 10,
}
