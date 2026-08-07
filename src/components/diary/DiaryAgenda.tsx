import { useMemo, useState } from 'react'
import type { EnrichedTrade } from '../../lib/types'
import { fmtJst } from '../../lib/timezone'
import { fmtMoney, fmtNum } from '../../lib/format'
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
 *
 * 見た目は手帳アプリの作り方に合わせている:
 *  - 左に日付の列を固定して、縦に一直線に並べる
 *  - さらに左端に、年と月を縦書きで置く
 *  - 一日ぶんを「帯」として、一日おきに濃さを変える
 *  - 出来事の頭に色の棒を立てる（ここでは損益の向きを表す）
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
      if (day < oldest && out.some((r) => r.trades.length || r.note)) break
      const list = byDay.get(day) ?? []
      out.push({
        day,
        trades: [...list].sort((a, b) => a.openJst.getTime() - b.openJst.getTime()),
        net: list.reduce((s, t) => s + t.netProfit, 0),
        note: dayNotes[day] ?? '',
        photos: list.reduce((s, t) => s + (imageCounts?.[t.id] ?? 0), 0),
      })
    }
    return out
  }, [span, today, oldest, byDay, dayNotes, imageCounts])

  const canMore = shift(today, -span) >= oldest
  /** 縦書きで出す年月。いちばん上に見えている日のもの */
  const head = rows[0]?.day ?? today

  return (
    <section
      // ロゴと同じ紫から青。ただし明るいままだと、上に載る白い小さな文字が
      // 読める濃さにならないので、同じ色みのまま暗くしてある
      className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#4A2ECC] to-[#2A44BF] text-white"
    >
      {/* 左端の縦書き。いま見ている年と月 */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1.5 top-6 select-none text-[10px] font-semibold uppercase tracking-[0.25em] text-white/75"
        style={{ writingMode: 'vertical-rl' }}
      >
        {fmtJst(`${head}T00:00:00+09:00`, 'yyyy')} {fmtJst(`${head}T00:00:00+09:00`, 'M月')}
      </span>

      <div className="pl-7">
        {rows.map((r, i) => (
          <DayBand
            key={r.day}
            row={r}
            isToday={r.day === today}
            // 一日おきに濃さを変えて、どこまでが一日か分かるようにする
            shaded={i % 2 === 1}
            onOpen={onOpen}
          />
        ))}

        <div className="px-3 py-5 text-center">
          {canMore ? (
            <button
              className="rounded-xl border border-white/25 px-4 py-2 text-xs font-semibold text-white/85 transition-colors hover:bg-white/10"
              onClick={() => setSpan((s) => s + MORE)}
            >
              さらに前を見る
            </button>
          ) : (
            <p className="text-[11px] text-white/70">ここが最初の記録です</p>
          )}
        </div>
      </div>

    </section>
  )
}

function DayBand({
  row,
  isToday,
  shaded,
  onOpen,
}: {
  row: Row
  isToday: boolean
  shaded: boolean
  onOpen: (day: string) => void
}) {
  const iso = `${row.day}T00:00:00+09:00`
  const wd = WEEKDAYS_JA[new Date(`${row.day}T00:00:00Z`).getUTCDay()]
  const empty = row.trades.length === 0 && !row.note

  return (
    <button
      onClick={() => onOpen(row.day)}
      className={`flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-white/10 ${
        shaded ? 'bg-white/[0.06]' : ''
      }`}
    >
      {/* 日付の列。幅を固定して、縦に一直線に並ぶようにする */}
      <span className="w-10 shrink-0 text-center">
        {isToday ? (
          // 今日だけ白い札にする。手帳アプリと同じ見せ方
          <span className="mx-auto flex h-11 w-10 flex-col items-center justify-center rounded-lg bg-white leading-none text-brand">
            <span className="text-[9px] font-bold uppercase tracking-wider">{wd}</span>
            <span className="mt-0.5 text-lg font-bold">{fmtJst(iso, 'd')}</span>
          </span>
        ) : (
          <span className="flex h-11 flex-col items-center justify-center leading-none">
            <span
              className={`text-[9px] font-bold uppercase tracking-wider ${
                wd === '日' ? 'text-[#FFB4A8]' : wd === '土' ? 'text-[#B8C4FF]' : 'text-white/70'
              }`}
            >
              {wd}
            </span>
            <span className="mt-0.5 text-lg font-bold text-white/90">{fmtJst(iso, 'd')}</span>
          </span>
        )}
      </span>

      {/* その日の出来事 */}
      <span className="min-w-0 flex-1 pt-0.5">
        {empty ? (
          <span className="flex h-10 items-center text-xs text-white/70">
            {isToday ? '今日のことを書く' : '記録なし'}
          </span>
        ) : (
          <span className="flex flex-col gap-1.5">
            {row.trades.map((t) => (
              <Entry
                key={t.id}
                bar={t.netProfit > 0 ? '#4ADE80' : t.netProfit < 0 ? '#FF8A7A' : '#FFFFFF80'}
                title={`${t.symbol} ${t.side === 'buy' ? '買い' : '売り'} ${fmtNum(t.volume, 2)}`}
                meta={`${fmtJst(t.open_time, 'HH:mm')} ・ ${fmtMoney(t.netProfit, { sign: true })}円${
                  t.setup ? ` ・ ${t.setup}` : ''
                }`}
              />
            ))}
            {row.note && <Entry bar="#FFFFFF" title="振り返り" meta={row.note} />}
            {row.photos > 0 && (
              <span className="flex items-center gap-1 pl-3 text-[11px] text-white/70">
                <Icon name="camera" size={12} />
                写真 {row.photos}枚
              </span>
            )}
          </span>
        )}
      </span>
    </button>
  )
}

/** 出来事1つ。頭の色の棒で、良し悪しが目で分かるようにする */
function Entry({ bar, title, meta }: { bar: string; title: string; meta: string }) {
  return (
    <span className="flex min-w-0 items-stretch gap-2">
      <span className="w-1 shrink-0 rounded-full" style={{ background: bar }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold leading-tight">{title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-white/70">{meta}</span>
      </span>
    </span>
  )
}

/** その日から delta 日ずらした日付（YYYY-MM-DD） */
function shift(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}
