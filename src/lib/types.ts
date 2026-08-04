export type Side = 'buy' | 'sell'

/** DB 上の取引レコード */
export interface Trade {
  id: string
  ticket: string | null
  symbol: string
  side: Side
  volume: number
  open_price: number
  close_price: number | null
  sl: number | null
  tp: number | null
  /** UTC の ISO 文字列 (真の瞬間) */
  open_time: string
  close_time: string | null
  commission: number
  swap: number
  profit: number
  currency: string
  note: string | null
  /** 添付スクショ (縮小した data URL)。一覧取得では省略され undefined になる */
  screenshot?: string | null
  source: string
  created_at?: string
}

/** 取込・手入力時に使う入力型 (id は DB が採番) */
export type TradeInput = Omit<Trade, 'id' | 'created_at'>

/** 分析用に各種指標を付与したトレード */
export interface EnrichedTrade extends Trade {
  /** 手数料・スワップ込みの純損益 */
  netProfit: number
  /** SL/TP から算出した計画リスクリワード (|TP-entry| / |entry-SL|) */
  plannedRR: number | null
  /** SL 幅 (価格) */
  riskPrice: number | null
  /** 実現した値幅 (方向を考慮した符号付き, entry 基準) */
  resultPrice: number | null
  /** 実現Rマルチプル (resultPrice / riskPrice) */
  rMultiple: number | null
  /** TP 目標に対して実際に取れた割合 (resultPrice / |TP-entry|) */
  capturedRatio: number | null
  /** TP に到達して利確したか */
  tpHit: boolean
  /** SL に到達して損切りしたか */
  slHit: boolean
  /** 勝ち (netProfit > 0) */
  win: boolean
  /** 日本時間の Date */
  openJst: Date
  closeJst: Date | null
  /** 日本時間の日付 (YYYY-MM-DD) */
  jstDay: string
  /** 日本時間の時間帯セッション */
  session: SessionKey
}

export type SessionKey = 'tokyo' | 'london' | 'ny' | 'other'

export interface DayNote {
  day: string
  note: string | null
  updated_at?: string
}
