/**
 * プランの決まりごと。
 *
 * 値段・上限・クレジットの単位を、ここ1か所にまとめてある。
 * 画面もサーバーも、この表だけを見る。
 * 値段が2か所に書いてあると、片方だけ直したときに
 * 「980円と書いてあるのに1,480円請求される」が起きる。
 *
 * ここに書いてあるのは「見せる値」で、実際に止めているのは
 * データベース側（RLS）。画面の数字を書き換えても、
 * 読めない日記が読めるようにはならない。
 */

export type PlanId = 'free' | 'pro'

/** 無料で読み返せる日数。これより前は、有料にすると戻ってくる */
export const FREE_DAYS = 30

/** 画像を何枚まで置けるか */
export const IMAGE_LIMIT: Record<PlanId, number> = {
  free: 50,
  pro: 1000,
}

/** クレジット1口で増える画像の枚数と、その値段 */
export const CREDIT_PACK = {
  images: 500,
  yen: 500,
} as const

export interface Plan {
  id: PlanId
  name: string
  /** 月あたりの値段（円）。無料は 0 */
  yen: number
  /** 何のためのプランか、ひと言で */
  blurb: string
  /** 並べて見せる中身 */
  points: string[]
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: '無料',
    yen: 0,
    blurb: 'まず自分の記録を入れてみる',
    points: [
      '取引の取り込みと記録（件数の制限なし）',
      '日記・チャート・振り返り（書くのは全部できます）',
      `読み返せるのは直近${FREE_DAYS}日ぶん`,
      `チャート画像は${IMAGE_LIMIT.free}枚まで`,
    ],
  },
  pro: {
    id: 'pro',
    name: 'スタンダード',
    yen: 980,
    blurb: '続けたぶんだけ、全部を見返せる',
    points: [
      '全期間を読み返せる（去年の同じ相場まで戻れます）',
      '分析・タイプ診断・型のアルバム',
      `チャート画像は${IMAGE_LIMIT.pro}枚まで`,
      'いつでも解約できます',
    ],
  },
}

/** いま契約している状態 */
export interface PlanState {
  plan: PlanId
  /** 有効期限。無料は null */
  periodEnd: string | null
  /** 期末で解約する予定か */
  cancelAtPeriodEnd: boolean
  /** 買い足した画像の枚数（クレジット） */
  extraImages: number
  /** いま置いてある画像の枚数 */
  usedImages: number
}

export const FREE_STATE: PlanState = {
  plan: 'free',
  periodEnd: null,
  cancelAtPeriodEnd: false,
  extraImages: 0,
  usedImages: 0,
}

/** その人が置ける画像の上限（プランのぶん＋買い足したぶん） */
export function imageLimitOf(s: PlanState): number {
  return IMAGE_LIMIT[s.plan] + s.extraImages
}

/** あと何枚置けるか。0 未満にはしない */
export function imagesLeft(s: PlanState): number {
  return Math.max(0, imageLimitOf(s) - s.usedImages)
}

/**
 * その日を読み返せるか。
 *
 * 無料プランは直近30日ぶんだけ。境目は「日」で切る。
 * 時刻で切ると、朝に読めた日記が夕方には読めなくなり、
 * 消えたのか壊れたのか分からなくなる。
 *
 * @param day  YYYY-MM-DD（日本時間の日付）
 * @param today 同じ形の今日
 */
export function canRead(s: PlanState, day: string, today: string): boolean {
  if (s.plan !== 'free') return true
  return day >= shiftDay(today, -(FREE_DAYS - 1))
}

/** 無料プランで読み返せる、いちばん古い日 */
export function oldestReadableDay(today: string): string {
  return shiftDay(today, -(FREE_DAYS - 1))
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

/** 「980円」のような表示。無料は「0円」ではなく「無料」と書く */
export function priceLabel(yen: number): string {
  return yen === 0 ? '無料' : `${yen.toLocaleString('ja-JP')}円`
}

/** 期限を「2026年9月15日まで」の形に。無い場合は null */
export function periodLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}
