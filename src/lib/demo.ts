import type { Account, Settings, Side, Trade, TradeImage } from './types'
import { jstDayKey } from './timezone'
import { demoChart } from './demoChart'
import { demoEntries, demoEntryDays } from './demoJournal'
import { plainText } from './journal'

/**
 * サンプル表示用のデータ。
 *
 * ログインしていない人が最初に見る画面。ここで何ができるアプリなのかが
 * 伝わらなければ、その先には進んでもらえない。だから
 * 「動くことが分かる最低限」ではなく、全部の機能が中身入りで見える形にする。
 *
 *   取引     … 型（押し目買いなど）・損切り・チャート画像つき
 *   口座     … 2つ。切り替えが実際に動くのが分かるように
 *   日記     … 題名・チャート・本文・気持ち・振り返り・学びまで書いてある
 *   カレンダー … 書いた日と取引のある日が、ひと月ぶん埋まっている
 *
 * すべて種（seed）から組み立てる決定論的な作り。開くたびに数字が変わると、
 * 保存されていないように見えるため。
 */

// 小さな決定論的 RNG (LCG)
function makeRng(seed: number) {
  let s = (seed >>> 0) || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

/** サンプルの取引につける印。本物のIDは UUID なので、ぶつからない */
const PREFIX = 'demo-'

export function isDemoId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(PREFIX)
}

/** サンプルの口座。2つあるので、口座の切り替えも見てもらえる */
export const DEMO_ACCOUNTS: Account[] = [
  {
    id: 'demo-account',
    broker: 'サンプル証券',
    login: '12345678',
    nickname: 'メイン',
    currency: 'JPY',
    lot_size: 100000,
    broker_utc_offset: 4,
    initial_capital: 300000,
    capital_note: 'サンプルの原資',
    is_default: true,
  },
  {
    id: 'demo-account-2',
    broker: 'サンプル証券',
    login: '87654321',
    nickname: '検証用',
    currency: 'JPY',
    lot_size: 100000,
    broker_utc_offset: 4,
    initial_capital: 100000,
    capital_note: '練習用に分けている口座',
    is_default: false,
  },
]

export const DEMO_SETTINGS: Settings = {
  user_id: 'demo',
  initial_capital: 300000,
  capital_note: 'サンプルの原資',
  account_currency: 'JPY',
  lot_size: 100000,
  broker_utc_offset: 4,
  main_symbol: 'XAUUSD',
  onboarded_at: '2026-01-01T00:00:00Z',
}

/**
 * 自分の型。
 *
 * 分析の「型」のところを空にしないために入れてある。
 * 名前は説明しなくても意味が分かるものだけにした
 */
const SETUPS = ['押し目買い', '戻り売り', 'ブレイク狙い', '指標後の戻り', null] as const

const SYMBOLS = [
  { name: 'XAUUSD.raw', base: 4000, span: 200, yenPerPoint: 15000 },
  { name: 'USDJPY', base: 152, span: 3, yenPerPoint: 100000 },
]

/** その日の何時に入ったか。相場が動く時間に寄せる */
const HOURS = [9, 10, 16, 17, 21, 22, 23]

/** JST の日付と時刻から、保存する形（UTC の瞬間）を作る */
function jstMoment(day: string, hour: number, minute: number): Date {
  return new Date(`${day}T${pad(hour)}:${pad(minute)}:00+09:00`)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * 直近45日ぶんの取引。
 *
 * 平日は0〜3件。土日は入れない（相場が閉まっているため）。
 * ただし日記のある日には必ず入れる。日記だけあって取引が無い日が続くと、
 * 「取り込んだ履歴から自動で出る」という肝心のところが見えない。
 */
export function demoTrades(today = jstDayKey(new Date().toISOString())): Trade[] {
  const rng = makeRng(20260803)
  const withEntry = new Set(demoEntryDays(today))
  const out: Trade[] = []
  let i = 0

  for (let back = 44; back >= 0; back--) {
    const day = shiftDay(today, -back)
    const wd = new Date(`${day}T00:00:00Z`).getUTCDay()
    const weekend = wd === 0 || wd === 6
    const mustHave = withEntry.has(day)
    if (weekend && !mustHave) continue

    // 記録が続いている感じを出す。毎日きっちり同じ件数だと作り物に見える
    let count = mustHave ? 1 + Math.floor(rng() * 3) : Math.floor(rng() * 3.4)
    if (count === 0) continue

    // 使う時間帯は日ごとに変える。全部同じ時間だと「時間帯」の分析が死ぬ
    const shuffled = [...HOURS].sort(() => rng() - 0.5)

    while (count-- > 0) {
      const sym = SYMBOLS[rng() < 0.72 ? 0 : 1]
      const side: Side = rng() > 0.5 ? 'buy' : 'sell'
      const dir = side === 'buy' ? 1 : -1
      const volume = [0.02, 0.05, 0.1][Math.floor(rng() * 3)]
      const entry = sym.base + (rng() - 0.5) * sym.span

      // 損切り幅と、狙っていた損益比
      const risk = (sym.span / 100) * (1.2 + rng() * 2.4)
      const rr = 1.2 + rng() * 1.8
      // たまに損切りを置き忘れている。「損切りを置けた割合」を出す意味が出る
      const noSl = rng() < 0.12
      const sl = entry - dir * risk
      const tp = entry + dir * risk * rr

      const win = rng() < 0.52
      const close = win
        ? entry + dir * risk * rr * Math.min(0.6 + rng() * 0.5, 1)
        : entry - dir * risk * Math.min(0.7 + rng() * 0.4, 1)

      const profit = Math.round((close - entry) * dir * volume * sym.yenPerPoint)
      const hour = shuffled[count % shuffled.length]
      const openAt = jstMoment(day, hour, Math.floor(rng() * 60))
      const closeAt = new Date(openAt.getTime() + (5 + rng() * 110) * 60_000)

      // 2つ目の口座は少なめ。検証用の口座という設定に合わせる
      const accountId = rng() < 0.22 ? DEMO_ACCOUNTS[1].id : DEMO_ACCOUNTS[0].id
      const setup = SETUPS[Math.floor(rng() * SETUPS.length)]

      out.push({
        id: `${PREFIX}${i}`,
        account_id: accountId,
        ticket: `DEMO-${1000 + i}`,
        symbol: sym.name,
        side,
        volume,
        open_price: round2(entry),
        close_price: round2(close),
        sl: noSl ? null : round2(sl),
        tp: round2(tp),
        open_time: openAt.toISOString(),
        close_time: closeAt.toISOString(),
        commission: -Math.round(volume * 400),
        swap: 0,
        profit,
        currency: 'JPY',
        note: noteFor(i, win, setup),
        setup,
        source: 'demo',
      })
      i++
    }
  }
  return out
}

/**
 * 取引につける一言。
 * 全部に付けない。全件にメモがある履歴は現実にはありえないし、
 * 「メモがある取引」が目立たなくなる
 */
function noteFor(i: number, win: boolean, setup: string | null): string | null {
  if (i % 4 !== 0) return null
  if (!setup) return '形が決まらないまま入った。理由を書けない。'
  return win
    ? `${setup}。決めた場所まで待てた。`
    : `${setup}。少し早く入った。もう一度戻るのを待てばよかった。`
}

/**
 * 取引に貼ってあるチャート画像。
 *
 * 全部の取引には付けない。何枚か貼ってある取引が混ざっているほうが、
 * 「貼れる」ことも「貼っていなくてもいい」ことも同時に伝わる。
 */
export function demoTradeImages(tradeId: string): TradeImage[] {
  const n = imageSeed(tradeId)
  if (n == null) return []

  const bias = n % 2 === 0 ? 1 : -1
  const side = bias > 0 ? 'buy' : 'sell'
  return [
    {
      id: `${tradeId}-img1`,
      trade_id: tradeId,
      image: demoChart({ seed: 500 + n, symbol: 'XAUUSD', timeframe: '15m', bias, side }),
      caption: 'エントリーしたところ',
    },
    {
      id: `${tradeId}-img2`,
      trade_id: tradeId,
      image: demoChart({ seed: 900 + n, symbol: 'XAUUSD', timeframe: '1h', bias, levels: false }),
      caption: '1時間足で見た形',
    },
  ]
}

/**
 * その取引に画像が付いているか。付いていれば絵の種を返す。
 * 数えるだけのときに絵まで組み立てないよう、判定はここに分けてある
 */
function imageSeed(tradeId: string): number | null {
  if (!isDemoId(tradeId)) return null
  const n = Number(tradeId.slice(PREFIX.length))
  if (!Number.isFinite(n) || n % 5 !== 0) return null
  return n
}

/**
 * どの取引に何枚貼ってあるか。一覧のバッジに使う。
 * 絵は組み立てない。枚数を出すだけのために数十枚描くことになるため
 */
export function demoTradeImageCounts(ids: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const id of ids) if (imageSeed(id) != null) out[id] = 2
  return out
}

/** サンプルの日記。日付をつけて組み立てる */
export function demoDayEntries(today = jstDayKey(new Date().toISOString())) {
  return demoEntries(today)
}

/** 一覧に出す、日ごとの題名と本文 */
export function demoDayText(today = jstDayKey(new Date().toISOString())): {
  notes: Record<string, string>
  titles: Record<string, string>
} {
  const notes: Record<string, string> = {}
  const titles: Record<string, string> = {}
  for (const [day, e] of Object.entries(demoDayEntries(today))) {
    notes[day] = plainText(e.blocks)
    titles[day] = e.title
  }
  return { notes, titles }
}

/** その日から delta 日ずらした日付（YYYY-MM-DD） */
function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
