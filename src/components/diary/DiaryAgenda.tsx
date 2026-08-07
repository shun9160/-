import { useMemo, useState } from 'react'
import type { EnrichedTrade } from '../../lib/types'
import { fmtJst } from '../../lib/timezone'
import { colorOf, fmtMoney } from '../../lib/format'
import Icon from '../Icon'

/**
 * 日記の入口。日付が縦に流れる一覧。
 *
 * これまでは1日ぶんだけを出し、前後のボタンで移っていた。それだと
 * 「書いた日」も「書いていない日」も見えず、日記として続けにくい。
 *
 * 日付を空けずに並べると、書いていない日が空白として目に入る。
 * 埋めたくなるし、書いた日が積み上がっているのも見える。
 * これは普通の日記帳と同じ仕組み。
 */

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

/** 最初に出す日数と、「さらに前」で足す日数 */
const FIRST = 30
const MORE = 30

interface Props {
  trades: EnrichedTrade[]
  dayNotes: Record<string, string>
  /** 取引ごとのチャート枚数。写真があることを一覧で示すのに使う */
  imageCounts?: Record<string, number>
  /** いちばん新しい日（YYYY-MM-DD）。ふつうは今日 */
  today: string
  onOpen: (day: string) => void
}

interface Row {
  day: string
  trades: EnrichedTrade[]
  net: number
  note: string
  photos: number
}

export default function DiaryAgenda({ trades, dayNotes, imageCounts, today, onOpen }: Props) {
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
    const days = [...byDay.keys(), ...Object.keys(dayNotes)].sort()
    return days[0] ?? today
  }, [byDay, dayNotes, today])

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    for (let i = 0; i < span; i++) {
      const day = shift(today, -i)
      // 記録のある日より前まで遡ったら、そこで止める
      if (day < oldest && out.some((r) => r.trades.length || r.note)) break
      const list = byDay.get(day) ?? []
      out.push({
        day,
        trades: list,
        net: list.reduce((s, t) => s + t.netProfit, 0),
        note: dayNotes[day] ?? '',
        photos: list.reduce((s, t) => s + (imageCounts?.[t.id] ?? 0), 0),
      })
    }
    return out
  }, [span, today, oldest, byDay, dayNotes, imageCounts])

  const canMore = shift(today, -span) >= oldest

  return (
    <div className="flex flex-col">
      {rows.map((r) => (
        <DayRow key={r.day} row={r} isToday={r.day === today} onOpen={onOpen} />
      ))}

      {canMore ? (
        <button className="btn btn-quiet mx-auto mt-4" onClick={() => setSpan((s) => s + MORE)}>
          さらに前を見る
        </button>
      ) : (
        <p className="mt-4 text-center text-xs text-ink3">ここが最初の記録です</p>
      )}
    </div>
  )
}

function DayRow({
  row,
  isToday,
  onOpen,
}: {
  row: Row
  isToday: boolean
  onOpen: (day: string) => void
}) {
  const iso = `${row.day}T00:00:00+09:00`
  const wd = WEEKDAYS_JA[new Date(`${row.day}T00:00:00Z`).getUTCDay()]
  const empty = row.trades.length === 0 && !row.note
  // 同じ型が並ぶので、重複は畳んでから出す
  const setups = [...new Set(row.trades.map((t) => t.setup).filter(Boolean))] as string[]

  return (
    <button
      onClick={() => onOpen(row.day)}
      className="flex w-full items-stretch gap-3 border-b border-line py-3 text-left transition-colors hover:bg-sunken/60"
    >
      {/* 日付。ここだけは幅を固定して、縦に一直線に並ぶようにする */}
      <span className="w-11 shrink-0 pt-0.5 text-center">
        <span
          className={`block text-[10px] font-semibold ${
            wd === '日' ? 'text-down' : wd === '土' ? 'text-brand' : 'text-ink3'
          }`}
        >
          {wd}
        </span>
        <span
          className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold leading-none ${
            isToday ? 'mx-auto bg-brand text-white' : 'text-ink'
          }`}
        >
          {fmtJst(iso, 'd')}
        </span>
        {/* 月が変わるところだけ、月を出す */}
        {fmtJst(iso, 'd') === '1' && (
          <span className="mt-0.5 block text-[10px] font-semibold text-ink2">
            {fmtJst(iso, 'M月')}
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        {empty ? (
          <span className="flex h-full items-center text-xs text-ink3">
            {isToday ? '今日のことを書く' : '記録なし'}
          </span>
        ) : (
          <>
            {row.trades.length > 0 && (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={`text-base font-bold tabular-nums ${colorOf(row.net)}`}>
                  {fmtMoney(row.net, { sign: true })}
                </span>
                <span className="text-[11px] text-ink3">{row.trades.length}件</span>
                {setups.map((s) => (
                  <span
                    key={s}
                    className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand"
                  >
                    {s}
                  </span>
                ))}
                {row.photos > 0 && (
                  <span className="flex items-center gap-0.5 text-[11px] text-ink3">
                    <Icon name="camera" size={12} />
                    {row.photos}
                  </span>
                )}
              </span>
            )}
            {row.note && (
              // 2行だけ見せる。全文は開いてから
              <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-ink2">
                {row.note}
              </span>
            )}
          </>
        )}
      </span>

      <span className="flex shrink-0 items-center text-ink3">
        <Icon name="right" size={16} />
      </span>
    </button>
  )
}

/** その日から delta 日ずらした日付（YYYY-MM-DD） */
function shift(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}
