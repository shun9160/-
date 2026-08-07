import type { EnrichedTrade } from './types'

/**
 * 型（セットアップ）ごとの集計と、「いいトレード」の見つけ方。
 *
 * 考え方:
 *  - 勝ったかどうかで良し悪しを決めない。相場は運が混ざるので、
 *    勝ち負けだけを褒めると「たまたま勝った雑な取引」を肯定してしまう
 *  - 決めた通りにやれたか（損切りを置いた・計画の幅で終えた）を見る
 *  - 数字だけを出して終わりにせず、次に何を見ればいいかを添える
 */

/** 型ひとつぶんの成績 */
export interface SetupStat {
  name: string
  count: number
  wins: number
  losses: number
  winRate: number
  net: number
  /** 損切りを置けていた割合 */
  slRate: number
  /** 狙いの損益比の平均。決めていなければ null */
  avgPlannedRR: number | null
  /** いちばん成績のよかった取引 */
  best: EnrichedTrade | null
  /** いちばん悪かった取引 */
  worst: EnrichedTrade | null
  /** 直近の取引日（YYYY-MM-DD） */
  lastDay: string | null
}

/** 型を決めていない取引をまとめる名前 */
export const NO_SETUP = '型なし'

/**
 * 型ごとにまとめる。
 * 件数の多い順。同じなら、直近に使った型を先に出す。
 */
export function setupStats(trades: EnrichedTrade[]): SetupStat[] {
  const groups = new Map<string, EnrichedTrade[]>()
  for (const t of trades) {
    const key = t.setup?.trim() || NO_SETUP
    const list = groups.get(key)
    if (list) list.push(t)
    else groups.set(key, [t])
  }

  const out: SetupStat[] = []
  for (const [name, list] of groups) {
    const wins = list.filter((t) => t.netProfit > 0).length
    const losses = list.filter((t) => t.netProfit < 0).length
    const withSl = list.filter((t) => t.sl != null).length
    const rr = list.map((t) => t.plannedRR).filter((r): r is number => r != null)
    const sorted = [...list].sort((a, b) => b.netProfit - a.netProfit)
    const days = list.map((t) => t.jstDay).sort()

    out.push({
      name,
      count: list.length,
      wins,
      losses,
      winRate: list.length ? wins / list.length : 0,
      net: list.reduce((s, t) => s + t.netProfit, 0),
      slRate: list.length ? withSl / list.length : 0,
      avgPlannedRR: rr.length ? rr.reduce((s, r) => s + r, 0) / rr.length : null,
      best: sorted[0] ?? null,
      worst: sorted[sorted.length - 1] ?? null,
      lastDay: days.length ? days[days.length - 1] : null,
    })
  }

  return out.sort(
    (a, b) => b.count - a.count || (b.lastDay ?? '').localeCompare(a.lastDay ?? ''),
  )
}

/** すでに使ったことのある型の名前。入力の候補に出す */
export function knownSetups(trades: EnrichedTrade[]): string[] {
  return setupStats(trades)
    .filter((s) => s.name !== NO_SETUP)
    .map((s) => s.name)
}

// ---------------------------------------------------------------
// いいトレード
// ---------------------------------------------------------------

export interface GoodTrade {
  trade: EnrichedTrade
  /** なぜ良かったのか。1つとは限らない */
  reasons: string[]
  /** 並べ替えに使う点。表には出さない */
  score: number
}

/**
 * 「いいトレード」を選ぶ。
 *
 * 勝ち額の大きさでは選ばない。大きく勝った取引は、
 * 大きく張っただけのことがあり、真似すべきとは限らないため。
 * 「決めた通りにやれたか」を軸にして、そこに結果を少し足す。
 */
export function goodTrades(trades: EnrichedTrade[], limit = 3): GoodTrade[] {
  const scored: GoodTrade[] = []

  for (const t of trades) {
    const reasons: string[] = []
    let score = 0

    if (t.sl != null) {
      reasons.push('損切りを置いてから入れた')
      score += 3
    }
    if (t.tpHit) {
      reasons.push('決めた利確ラインまで持てた')
      score += 3
    }
    if (t.plannedRR != null && t.plannedRR >= 2) {
      reasons.push(`狙いの損益比が 1:${t.plannedRR.toFixed(1)} と大きい`)
      score += 2
    }
    if (t.rMultiple != null && t.rMultiple >= 1.5) {
      reasons.push(`損切り幅の ${t.rMultiple.toFixed(1)} 倍を取れた`)
      score += 2
    }
    // 負けでも、決めた幅で切れていれば良い取引として扱う
    if (t.netProfit < 0 && t.slHit && t.sl != null) {
      reasons.push('負けたが、決めた幅で切れた')
      score += 2
    }
    if (t.note && t.note.trim().length >= 10) {
      reasons.push('記録が残っている')
      score += 1
    }
    if (t.netProfit > 0) score += 1

    // 理由が1つもないものは選ばない。「なんとなく良い」は出さない
    if (reasons.length >= 2) scored.push({ trade: t, reasons, score })
  }

  return scored
    .sort((a, b) => b.score - a.score || b.trade.netProfit - a.trade.netProfit)
    .slice(0, limit)
}
