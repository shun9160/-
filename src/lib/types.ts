export type Side = 'buy' | 'sell'

/** 取引口座。1人が複数持てる */
export interface Account {
  id: string
  /** ブローカー名 */
  broker: string | null
  /** 口座番号 (MT5のログインID) */
  login: string | null
  /** 表示名 (任意) */
  nickname: string | null
  currency: string
  lot_size: number
  /** MT5サーバーの時差 (UTCから何時間か) */
  broker_utc_offset: number
  /** この口座の原資 */
  initial_capital: number
  capital_note: string | null
  /** 証拠スクショ。一覧取得では省略され undefined になる */
  capital_screenshot?: string | null
  /** 記録先の初期値にする口座か */
  is_default: boolean
  created_at?: string
}

/** 口座の見出し。「Exness 12345678」のように読める形にする */
export function accountLabel(a: Account): string {
  if (a.nickname) return a.nickname
  const parts = [a.broker, a.login].filter((x): x is string => !!x && x.trim() !== '')
  return parts.length ? parts.join(' ') : '名前のない口座'
}

/** DB 上の取引レコード */
export interface Trade {
  id: string
  /** どの口座の取引か。取込時点では未定なので省略できる */
  account_id?: string | null
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

/** 取引に貼ったチャート画像。1取引に何枚でも持てる */
export interface TradeImage {
  id: string
  trade_id: string
  /** 縮小した data URL */
  image: string
  /** 「エントリー」「決済後」などの説明 */
  caption: string | null
  created_at?: string
}

export type SessionKey = 'tokyo' | 'london' | 'ny' | 'other'

export interface DayNote {
  day: string
  note: string | null
  updated_at?: string
}

/** 設定（原資など）。利用者ごとに1行 */
export interface Settings {
  user_id: string
  /** 原資（元本） */
  initial_capital: number
  capital_note: string | null
  /** 証拠スクショ。一覧取得では省略され undefined になる */
  capital_screenshot?: string | null
  /** 口座の通貨 */
  account_currency: string
  /** 1ロットの通貨量 */
  lot_size: number
  /** MT5サーバーの時差（UTCから何時間か） */
  broker_utc_offset: number
  main_symbol: string | null
  /** 初期設定を終えた日時。null なら未設定 */
  onboarded_at: string | null
  updated_at?: string
}
