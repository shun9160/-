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
 *
 * 面の色は下のタブと同じ night。以前はロゴの紫→青を敷いていたが、
 * この画面だけ彩度が高く、ほかの画面と別のアプリに見えていた。
 * 「濃い面はタブと日記だけ」と決めて、全画面で色を3つに絞っている。
 */

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

/** 縦書き。数字も横に倒さず、立てたまま重ねる */
const VERTICAL = { writingMode: 'vertical-rl', textOrientation: 'upright' } as const

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
  /** いちばん新しい日（YYYY-MM-DD）。ふつうは今日 */
  today: string
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
  onOpen,
}: Props) {
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
    return days[0] ?? today
  }, [byDay, dayNotes, dayTitles, today])

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    for (let i = 0; i < span; i++) {
      const day = shift(today, -i)
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
  }, [span, today, oldest, byDay, dayNotes, dayTitles, imageCounts])

  const canMore = shift(today, -span) >= oldest
  /** 縦書きで出す年月。いちばん上に見えている日のもの */
  const head = rows[0]?.day ?? today

  return (
    <section
      // 濃色の面ひとつ。下のタブと同じ色にして、同じ「暗い面」だと分かるようにする。
      // 狭い画面では左右の余白ぶんだけ外へ出し、画面の端まで面を届かせる
      className="relative -mx-4 overflow-hidden bg-night text-white sm:mx-0 sm:rounded-xl"
    >
      {/* 日付の列の下地。行ごとではなく1枚で敷くので、
          いちばん下まで途切れずに1本の柱に見える。
          面の中をさらに割るので、色は night より一段だけ暗くする */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-[4.5rem] bg-[#0D0C14]"
      />

      {/* 柱の中に、いま見ている年と月を縦書きで入れる */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1.5 top-6 z-10 flex select-none flex-col items-center gap-2.5 text-[10px] font-semibold text-white/70"
      >
        {/* 年と月は別の行にする。ひとつづきにすると、縦組みでは
            数字と漢字の送り幅が違って重なることがある */}
        <span className="tracking-[0.18em]" style={VERTICAL}>
          {fmtJst(`${head}T00:00:00+09:00`, 'yyyy')}
        </span>
        <span className="tracking-[0.1em]" style={VERTICAL}>
          {fmtJst(`${head}T00:00:00+09:00`, 'M')}月
        </span>
      </span>

      <div className="relative">
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

        {/* 柱のぶんだけ空けて、文字が柱に重ならないようにする */}
        <div className="py-5 pl-[4.5rem] pr-3 text-center">
          {canMore ? (
            <button
              className="rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white/85 transition-colors hover:bg-white/[0.16]"
              onClick={() => setSpan((s) => s + MORE)}
            >
              さらに前を見る
            </button>
          ) : (
            <p className="text-[11px] text-white/75">ここが最初の記録です</p>
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
  onOpen: (day: string, y: number) => void
}) {
  const iso = `${row.day}T00:00:00+09:00`
  const wd = WEEKDAYS_JA[new Date(`${row.day}T00:00:00Z`).getUTCDay()]
  const empty = row.trades.length === 0 && !row.note && !row.title

  return (
    <button
      onClick={(e) => onOpen(row.day, e.currentTarget.getBoundingClientRect().top)}
      className="flex w-full items-stretch text-left"
    >
      {/* 左の列。下地は section 側で1枚に敷いてあるので、ここは中身だけ。
          日付を右に寄せて、縦に一直線に並ぶ「背骨」に見えるようにする */}
      <span className="flex w-[4.5rem] shrink-0 justify-end py-3 pr-3">
        {isToday ? (
          // 今日だけ札にする。手帳アプリと同じ見せ方。
          // 暗い面の中でブランドの色を使うのはここだけ
          <span className="flex h-11 w-10 flex-col items-center justify-center rounded-lg bg-brand leading-none text-white">
            <span className="text-[9px] font-bold uppercase tracking-wider">{wd}</span>
            <span className="mt-0.5 text-lg font-bold">{fmtJst(iso, 'd')}</span>
          </span>
        ) : (
          <span className="flex h-11 flex-col items-center justify-center leading-none">
            <span
              className={`text-[9px] font-bold uppercase tracking-wider ${
                wd === '日' ? 'text-[#FFB4A8]' : wd === '土' ? 'text-[#B8C4FF]' : 'text-white/75'
              }`}
            >
              {wd}
            </span>
            <span className="mt-0.5 text-lg font-bold text-white/90">{fmtJst(iso, 'd')}</span>
          </span>
        )}
      </span>

      {/* その日の出来事。ここだけ一日おきに濃さを変える */}
      <span
        // 面がじゅうぶん暗いので、ここは白をごく薄く混ぜて一段持ち上げる。
        // それでも白い文字とのコントラストは 12:1 以上ある（測って確かめた）
        className={`min-w-0 flex-1 py-3 pl-3 pr-3 ${shaded ? 'bg-white/[0.045]' : ''}`}
      >
        {empty ? (
          <span className="flex h-10 items-center text-xs text-white/75">
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
            {(row.title || row.note) && (
              <Entry bar="#FFFFFF" title={row.title || '振り返り'} meta={row.note} />
            )}
            {row.photos > 0 && (
              <span className="flex items-center gap-1 pl-3 text-[11px] text-white/75">
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
        <span className="mt-0.5 block truncate text-[11px] text-white/75">{meta}</span>
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
