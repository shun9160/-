import { useMemo, useState } from 'react'
import type { EnrichedTrade } from '../../lib/types'
import { fmtJst } from '../../lib/timezone'
import { colorOf, fmtMoney } from '../../lib/format'
import Icon from '../Icon'

/**
 * 日記の入口。書いたものが積み上がっていくのを見るところ。
 *
 * 日付を空けずに並べる。書いていない日が空白として目に入り、
 * 埋めたくなる。書いた日が積み上がっているのも見える。
 * これは普通の日記帳と同じ仕組み。
 *
 * 見せ方の決まりごと:
 *  - 日付は左に縦積み。縦に一直線に並ぶ「背骨」にする
 *  - 中身のある日だけ、右に白い面を置く。押すとその日が開く
 *  - 何も無い日は面を作らず、細い行だけにする。
 *    空の面が並ぶと、見るものが無いのに画面が重くなる
 *  - いちばん上に濃い帯を1本。ここから下が一覧だと分かる目印
 *
 * 以前はこの画面ぜんぶを濃い色で塗っていたが、
 * 情報がぎっしり詰まって見え、どこを見ればいいのか分からなかった。
 * 濃い色は区切りの帯だけに使い、中身は白い面と余白で並べる。
 */

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

/** 最初に出す日数と、「さらに前」で足す日数 */
const FIRST = 30
const MORE = 30

interface Props {
  trades: EnrichedTrade[]
  dayNotes: Record<string, string>
  /** 日ごとの題名。あればメモより先に出す */
  dayTitles?: Record<string, string>
  /** 取引ごとのチャート枚数。写真があることを一覧で示すのに使う */
  imageCounts?: Record<string, number>
  /** 今日（YYYY-MM-DD）。今日だけ見た目を変えるのに使う */
  today: string
  /**
   * 一覧の始まり。ここから過去へさかのぼる。
   * 今日ぶんを上の紫のカードが受け持つときは、昨日を渡す
   */
  startFrom?: string
  /** 日を開く。y は押した場所の高さで、そこを軸に開く動きに使う */
  onOpen: (day: string, y: number) => void
}

interface Row {
  day: string
  trades: EnrichedTrade[]
  net: number
  note: string
  /** その日の記事の題名。書いてあれば、メモの代わりにこれを出す */
  title: string
  photos: number
}

export default function DiaryAgenda({
  trades,
  dayNotes,
  dayTitles,
  imageCounts,
  today,
  startFrom,
  onOpen,
}: Props) {
  const head = startFrom ?? today
  const [span, setSpan] = useState(FIRST)

  const byDay = useMemo(() => {
    const m = new Map<string, EnrichedTrade[]>()
    for (const t of trades) {
      const list = m.get(t.jstDay)
      if (list) list.push(t)
      else m.set(t.jstDay, [t])
    }
    return m
  }, [trades])

  /** いちばん古い記録。そこまでは「さらに前」で辿れる */
  const oldest = useMemo(() => {
    const days = [...byDay.keys(), ...Object.keys(dayNotes), ...Object.keys(dayTitles ?? {})].sort()
    return days[0] ?? head
  }, [byDay, dayNotes, dayTitles, head])

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    for (let i = 0; i < span; i++) {
      const day = shift(head, -i)
      if (day < oldest && out.some((r) => r.trades.length || r.note || r.title)) break
      const list = byDay.get(day) ?? []
      out.push({
        day,
        trades: [...list].sort((a, b) => a.openJst.getTime() - b.openJst.getTime()),
        net: list.reduce((s, t) => s + t.netProfit, 0),
        note: dayNotes[day] ?? '',
        title: dayTitles?.[day] ?? '',
        photos: list.reduce((s, t) => s + (imageCounts?.[t.id] ?? 0), 0),
      })
    }
    return out
  }, [span, head, oldest, byDay, dayNotes, dayTitles, imageCounts])

  const canMore = shift(head, -span) >= oldest
  /** 書いた日の数。続いていることが目に見えるように出す */
  const written = rows.filter((r) => r.title || r.note).length

  return (
    <section>
      {/* 濃い帯。ここから下が一覧だという目印。
          下のタブと同じ色にして、「濃い面」の使いどころをそろえる */}
      <div className="-mx-4 flex items-center gap-3 bg-night px-4 py-2.5 text-white sm:mx-0 sm:rounded-xl">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
          これまで
        </span>
        <span className="text-[13px] font-bold tabular-nums">
          {written}
          <span className="ml-0.5 text-[11px] font-semibold text-white/70">日ぶん</span>
        </span>
        <span className="ml-auto text-[11px] text-white/60">押すとその日を開けます</span>
      </div>

      <ul className="mt-3 flex flex-col">
        {rows.map((r) => (
          <DayRow key={r.day} row={r} isToday={r.day === today} onOpen={onOpen} />
        ))}
      </ul>

      <div className="py-5 text-center">
        {canMore ? (
          <button
            className="rounded-lg bg-sunken px-4 py-2 text-xs font-semibold text-ink2 transition-colors hover:bg-line"
            onClick={() => setSpan((s) => s + MORE)}
          >
            さらに前を見る
          </button>
        ) : (
          <p className="text-[11px] text-ink3">ここが最初の記録です</p>
        )}
      </div>
    </section>
  )
}

function DayRow({
  row,
  isToday,
  onOpen,
}: {
  row: Row
  isToday: boolean
  onOpen: (day: string, y: number) => void
}) {
  const iso = `${row.day}T00:00:00+09:00`
  const wd = WEEKDAYS_JA[new Date(`${row.day}T00:00:00Z`).getUTCDay()]
  const empty = row.trades.length === 0 && !row.note && !row.title

  /** 左の日付。中身があってもなくても、同じ場所に同じ幅で並ぶ */
  const date = (
    <span className="w-11 shrink-0 pt-1 text-right">
      <span className="block text-[10px] font-semibold text-ink3">{fmtJst(iso, 'M月')}</span>
      <span
        className={`block text-[19px] font-bold leading-none tabular-nums ${
          empty ? 'text-ink3' : 'text-ink'
        }`}
      >
        {fmtJst(iso, 'd')}
      </span>
      <span
        className={`mt-0.5 block text-[10px] font-semibold ${
          wd === '日' ? 'text-down' : wd === '土' ? 'text-[#4A6BFF]' : 'text-ink3'
        }`}
      >
        {wd}
      </span>
    </span>
  )

  // 何も無い日は面を作らない。空の白い箱が並ぶと、見るものが無いのに重くなる
  if (empty && !isToday) {
    return (
      <li className="flex gap-3 py-1.5">
        {date}
        <span className="flex min-w-0 flex-1 items-center pt-1 text-[12px] text-ink3">
          記録なし
        </span>
      </li>
    )
  }

  const wrote = !!(row.title || row.note)
  const money = (
    <>
      <span className="tabular-nums">{row.trades.length}件</span>
      <span className={`font-bold tabular-nums ${colorOf(row.net)}`}>
        {fmtMoney(row.net, { sign: true })}円
      </span>
      <span className="truncate">
        {row.trades[0]?.symbol}
        {row.trades.length > 1 && ' ほか'}
      </span>
      {row.photos > 0 && (
        <span className="flex items-center gap-0.5">
          <Icon name="camera" size={11} />
          {row.photos}
        </span>
      )}
    </>
  )

  return (
    <li className="flex gap-3 py-1.5">
      {date}
      <button
        onClick={(e) => onOpen(row.day, e.currentTarget.getBoundingClientRect().top)}
        className={`flex min-w-0 flex-1 items-start gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
          empty
            ? // 今日でまだ何も無いとき。ここだけ色を付けて、書き始める場所だと分かるようにする
              'bg-brand-soft hover:bg-brand-soft/70'
            : 'border border-line bg-surface hover:bg-sunken'
        }`}
      >
        <span className="min-w-0 flex-1">
          {empty ? (
            <>
              <span className="block truncate text-[15px] font-bold text-brand">
                今日のことを書く
              </span>
              <span className="mt-0.5 block text-[12px] text-brand/70">
                チャートを貼って、考えていたことを残しておく
              </span>
            </>
          ) : wrote ? (
            <>
              {/* 書いてある日は、書いた言葉が主役 */}
              <span className="block truncate text-[15px] font-bold text-ink">
                {row.title || row.note}
              </span>
              {row.trades.length > 0 && (
                <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-ink3">
                  {money}
                </span>
              )}
            </>
          ) : (
            <>
              {/*
                取引はあるが、まだ書いていない日。
                主役はその日の事実のほう。「書く」を大きく出すと、
                毎日「書け」と言われているように見えて重くなる
              */}
              <span className="flex flex-wrap items-center gap-x-2 text-[14px] text-ink">
                {money}
              </span>
              <span className="mt-0.5 block text-[12px] text-ink3">まだ書いていません</span>
            </>
          )}
        </span>

        <span className={`shrink-0 pt-0.5 ${empty ? 'text-brand' : 'text-ink3'}`}>
          <Icon name="right" size={16} />
        </span>
      </button>
    </li>
  )
}

/** その日から delta 日ずらした日付（YYYY-MM-DD） */
function shift(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}
