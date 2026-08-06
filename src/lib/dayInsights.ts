/**
 * その日の記録から読み取れることを、短い文にする。
 *
 * 決まった条件で並べているだけで、外部のAIには一切送っていない。
 * 「よく効いた点」を先に、「次に直せる点」をあとに出す。
 * 責めない・煽らない・売買をすすめない、の3つを守ること。
 */

import type { EnrichedTrade } from './types'
import { SESSION_LABELS } from './timezone'
import { sessionBreakdown } from './analytics'
import { fmtMoney } from './format'

export interface DayInsight {
  key: string
  text: string
  tone: 'good' | 'warn' | 'info'
}

/** 損切り直後の入り直しと見なす分数 */
const REENTRY_MINUTES = 15
const MAX_ITEMS = 4

export function dayInsights(trades: EnrichedTrade[], note?: string | null): DayInsight[] {
  if (trades.length === 0) return []

  const good: DayInsight[] = []
  const warn: DayInsight[] = []
  const info: DayInsight[] = []

  // よく効いた時間帯
  const sessions = sessionBreakdown(trades).filter((s) => s.count > 0)
  const top = [...sessions].sort((a, b) => b.net - a.net)[0]
  if (top && top.net > 0 && top.count >= 2) {
    good.push({
      key: 'session',
      text: `${SESSION_LABELS[top.key].split(' ')[0]}のエントリーがうまく機能しました`,
      tone: 'good',
    })
  }

  // 狙いの大きかった取引
  const bigRR = trades.filter((t) => t.plannedRR != null && t.plannedRR >= 2)
  if (bigRR.length > 0) {
    good.push({
      key: 'rr',
      text: `計画リスクリワード2.0以上の取引が${bigRR.length}件ありました`,
      tone: 'good',
    })
  }

  // 決めた通りに終えられたか
  const planned = trades.filter((t) => t.tpHit || t.slHit)
  if (planned.length > 0) {
    good.push({
      key: 'planned',
      text: `決めたラインで終えた取引が${planned.length}件ありました`,
      tone: 'good',
    })
  }

  // 損切りを置けているか
  const noSl = trades.filter((t) => t.sl == null)
  if (noSl.length === 0) {
    good.push({ key: 'sl-all', text: 'すべての取引で損切りを置けています', tone: 'good' })
  } else {
    warn.push({
      key: 'sl-missing',
      text: `損切りを置かずに入った取引が${noSl.length}件ありました`,
      tone: 'warn',
    })
  }

  // 損切り直後の入り直し
  const sorted = [...trades].sort((a, b) => a.openJst.getTime() - b.openJst.getTime())
  let reentry = 0
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    if (!prev.closeJst || prev.netProfit >= 0) continue
    const gap = (sorted[i].openJst.getTime() - prev.closeJst.getTime()) / 60000
    if (gap >= 0 && gap <= REENTRY_MINUTES) reentry += 1
  }
  if (reentry > 0) {
    warn.push({
      key: 'reentry',
      text: `損切りの直後に入り直した取引が${reentry}件ありました`,
      tone: 'warn',
    })
  }

  // 守れた面も必ず見せる
  const net = trades.reduce((s, t) => s + t.netProfit, 0)
  const worst = Math.min(...trades.map((t) => t.netProfit))
  if (net < 0 && noSl.length === 0) {
    info.push({
      key: 'contained',
      text: `負け越しましたが、1件あたりの損失は${fmtMoney(Math.abs(worst))}までに収まっています`,
      tone: 'info',
    })
  }

  if (!note || note.trim() === '') {
    info.push({ key: 'note', text: '振り返りを書いておくと、次に見返せます', tone: 'info' })
  }

  return [...good, ...warn, ...info].slice(0, MAX_ITEMS)
}
