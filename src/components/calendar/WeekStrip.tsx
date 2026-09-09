import { useEffect, useMemo, useRef, useState } from 'react'
import { fmtJst } from '../../lib/timezone'
import Icon from '../Icon'
import MonthPicker from './MonthPicker'

/**
 * 上に置く、日付の並び。
 *
 * ひと月ぶんを大きく出すと、それ自体が主役になってしまう。
 * ここで選ぶのは「どの日の中身を見るか」なので、
 * 1行だけにして、あとは中身に場所をゆずる。
 *
 * 横に流して過去へ辿れる。1週間ずつ矢印で送るより、
 * 指で流したほうが速いし、途中の日も目に入る。
 * 矢印は残してある（画面が広いときや、正確に1週間送りたいとき用）。
 * 止まる位置は日の切れ目に吸い付かせる。半分だけ見えている日を作らない。
 *
 * 組み方:
 *   年と月は左に2段。そこから細い縦線1本で日付と分ける。
 *   囲いを作らず、線1本だけで「暦の見出し」と「日付」を分ける。
 *   年月は、選んでいる日が見えている間はその日のもの。
 *   指で流して選んでいる日が見えなくなったら、見えている日のほうに合わせる。
 *   一度「左端に見えている日」に合わせていたことがあるが、それだと
 *   9月4日を選んでいるのに見出しが「8月」になり、
 *   すぐ下のカードの日付と食い違って読めた。
 *   選んでいる日が見えているかどうかで分けると、どちらも起きない。
 *
 * 紫の面の上に載せることもある（日記の入口カードと1つにまとめたとき）。
 * そのときは onDark を立てる。色を白系に入れ替える。
 *
 * 取引があった日は下に点を打つ。数字を入れると窮屈になるうえ、
 * 金額はすぐ下のカードと履歴に出るので、ここでは「あったか無いか」だけ。
 */

const WEEKDAYS_JA = ['月', '火', '水', '木', '金', '土', '日']

/** さかのぼれる日数。ひと目盛り分の幅×この数だけ横に並ぶ */
const SPAN = 180
/** 1日ぶんの幅と間隔(px)。左端の日を割り出すのにも使う */
const CELL = 46
const GAP = 2

interface Props {
  /** 選んでいる日（YYYY-MM-DD） */
  value: string
  onChange: (day: string) => void
  /** 取引のあった日。点を打つのに使う */
  activeDays: Set<string>
  /** ここから先へは進ませない（ふつうは今日） */
  max: string
  /** 濃い面（紫）の上に置くか。色を白系に入れ替える */
  onDark?: boolean
}

export default function WeekStrip({ value, onChange, activeDays, max, onDark }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [tail, setTail] = useState(0)
  const [picking, setPicking] = useState(false)
  /**
   * 選んでいる日が流れて見えなくなったときに、いま見えている月（YYYY-MM）。
   * 選んでいる日が見えている間は null にして、その日の月を出す
   */
  const [away, setAway] = useState<string | null>(null)

  /*
    並べる範囲。
    選んでいる月の終わりから少し先まで（ただし今日は超えない）を右端にして、
    そこから SPAN 日ぶんさかのぼる。

    ずっと「今日まで」で作っていたが、それだと見出しから何ヶ月も前の月へ
    飛んだときに、その日が並びの外に出てしまい、どこにも印が付かなくなる。
    かといって今日までを全部並べると、古い月を開くほど目盛りが増えていく。
    月の区切りで決めておけば、同じ月の中で日を移しても並びは作り直されない。
  */
  const end = useMemo(() => min(shift(endOfMonth(value), 30), max), [value, max])
  const days = useMemo(
    () => Array.from({ length: SPAN }, (_, i) => shift(end, -(SPAN - 1 - i))),
    [end],
  )

  /*
    右端の余り。
    いちばん新しい日は右端にあるので、そこを見ているときは
    それ以上流せない位置で止まる。その止まる位置は日の切れ目とは限らず、
    左端の日が途中で切れて、隣の縦線とぶつかって残る。
    見えている幅は端末ごとに違うので、余りぶんだけ後ろに空きを足して、
    行き止まりのほうを切れ目に合わせる。
  */
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const step = CELL + GAP
    const measure = () => {
      const body = days.length * step - GAP // 空きを除いた中身の幅
      setTail((((el.clientWidth - body - GAP) % step) + step) % step)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [days])

  /** 選んだ日が見えるところまで寄せる */
  function scrollTo(day: string, smooth: boolean) {
    const el = boxRef.current
    if (!el) return
    const i = days.indexOf(day)
    if (i < 0) return
    // 真ん中あたりに置く。端に寄せると前後が見えなくなる。
    // ただし止める位置は日の切れ目に合わせる。
    // 途中で切った日が左端に残ると、隣の縦線とぶつかって
    // 「1」や「0」だけが取り残されたように見える
    const step = CELL + GAP
    const back = Math.round(el.clientWidth / 2 / step)
    const left = (i - back) * step
    el.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' })
  }

  // 開いたときと、外から日が変わったときに寄せる。
  // 右端の余りが決まると行き止まりの位置も変わるので、そのときも寄せ直す
  useEffect(() => {
    setAway(null)
    scrollTo(value, false)
    // days は max が変わったときだけ作り直される
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, days, tail])

  /**
   * 見出しに出す月を決め直す。指で流すたびに呼ばれる。
   *
   * 選んでいる日が見えている間は、その日の月を出す。
   * ここを「左端に見えている日」にすると、月をまたいだ端で
   * 9月4日を選んでいるのに見出しが8月になり、すぐ下のカードと食い違う。
   *
   * 選んでいる日が流れて見えなくなったら、見えている日のほうに合わせる。
   * 何月あたりを見ているのかが、指の動きと一緒に分かる。
   */
  function updateHead() {
    const el = boxRef.current
    // 幅が測れないうちは、何が見えているか分からない。選んだ日に任せる
    if (!el || el.clientWidth === 0) return setAway(null)

    const step = CELL + GAP
    const first = Math.round(el.scrollLeft / step)
    const count = Math.max(1, Math.floor(el.clientWidth / step))
    const last = Math.min(days.length - 1, first + count - 1)

    const sel = days.indexOf(value)
    if (sel >= first && sel <= last) return setAway(null)

    // 見えている日のうち、いちばん多い月。
    // 端に1日だけ食い込んだ月に引っぱられないようにする
    const tally = new Map<string, number>()
    for (let i = Math.max(0, first); i <= last; i++) {
      const m = days[i].slice(0, 7)
      tally.set(m, (tally.get(m) ?? 0) + 1)
    }
    let best = value.slice(0, 7)
    let most = 0
    for (const [m, n] of tally) {
      if (n > most) {
        best = m
        most = n
      }
    }
    setAway(best)
  }

  /** 見出しに出す月。ふつうは選んでいる日の月 */
  const headMonth = away ?? value.slice(0, 7)
  const iso = `${headMonth}-01T00:00:00+09:00`
  const canNext = value < max

  return (
    <div>
      {/* 週ごとに送る矢印。指で流せるので、こちらは控えめに */}
      <div className="flex justify-end gap-0.5">
        <Nav dir="left" onDark={onDark} onClick={() => onChange(shift(value, -7))} />
        <Nav
          dir="right"
          onDark={onDark}
          onClick={() => canNext && onChange(min(shift(value, 7), max))}
          disabled={!canNext}
        />
      </div>

      <div className="flex items-stretch gap-3">
        {/*
          年と月。囲わず、細い線1本だけで日付と分ける。
          押すと月を選べる。指で流して何ヶ月も戻るのは骨が折れる。
          押せることは、年のとなりの小さな印で出す。
          月のほうに付けると「12月」で幅からはみ出す
        */}
        <button
          type="button"
          onClick={() => setPicking(true)}
          aria-haspopup="dialog"
          aria-label={`${fmtJst(iso, 'yyyy')}年${fmtJst(iso, 'M')}月。押すと年と月を選べます`}
          /*
            見た目は今までと同じ場所のまま、押せる幅だけを 44px にする。
            カードの内側の余白へ 4px はみ出し、その分を左の余白で戻しているので、
            字の位置も仕切り線の位置も動かない
          */
          className={`-ml-1 w-11 shrink-0 pl-1 pt-1.5 text-left transition-opacity active:opacity-60 ${
            onDark ? '' : 'text-ink'
          }`}
        >
          <span
            className={`flex items-center gap-0.5 text-[11px] font-semibold leading-none ${
              onDark ? 'text-white/80' : 'text-ink3'
            }`}
          >
            {fmtJst(iso, 'yyyy')}
            <Icon name="down" size={10} className="shrink-0" />
          </span>
          <span className="mt-1 block text-[18px] font-bold leading-none tracking-tight">
            {fmtJst(iso, 'M')}月
          </span>
        </button>
        <div aria-hidden="true" className={`w-px shrink-0 ${onDark ? 'bg-white/25' : 'bg-line'}`} />

        <div
          ref={boxRef}
          onScroll={updateHead}
          className="flex min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto"
          style={{ gap: GAP, scrollbarWidth: 'none', overscrollBehaviorX: 'contain' }}
        >
          {days.map((day) => {
            const on = day === value
            const has = activeDays.has(day)
            const wd = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  onChange(day)
                  scrollTo(day, true)
                }}
                style={{ width: CELL }}
                className={`flex shrink-0 snap-start flex-col items-center gap-1 rounded-xl py-1.5 transition-colors ${
                  on
                    ? onDark
                      ? 'bg-white text-[#3A2FC0]'
                      : 'bg-night text-white'
                    : onDark
                      ? 'text-white'
                      : 'text-ink2'
                }`}
              >
                {/*
                  紫の上では、土日の青と赤が沈んで読めない。
                  白の濃さだけで出す（白80%で 5.15、選んだ日は白地なので十分）
                */}
                <span
                  className={`text-[10px] font-semibold ${
                    on
                      ? onDark
                        ? 'text-[#3A2FC0]/80'
                        : 'text-white/70'
                      : onDark
                        ? 'text-white/80'
                        : wd === 5
                          ? 'text-[#4A6BFF]'
                          : wd === 6
                            ? 'text-down'
                            : ''
                  }`}
                >
                  {WEEKDAYS_JA[wd]}
                </span>
                <span
                  className={`text-[16px] font-bold leading-none tabular-nums ${
                    on ? '' : onDark ? 'text-white' : 'text-ink'
                  }`}
                >
                  {fmtJst(`${day}T00:00:00+09:00`, 'd')}
                </span>
                {/* 取引があった日の印。無い日は同じ高さの空きを残して、
                    数字の位置が上下にずれないようにする */}
                <span
                  aria-hidden="true"
                  className={`h-1 w-1 rounded-full ${
                    has
                      ? on
                        ? onDark
                          ? 'bg-[#3A2FC0]'
                          : 'bg-white'
                        : onDark
                          ? 'bg-white'
                          : 'bg-brand'
                      : 'bg-transparent'
                  }`}
                />
              </button>
            )
          })}
          {/* 行き止まりを日の切れ目に合わせるための空き */}
          <div aria-hidden="true" className="shrink-0" style={{ width: tail }} />
        </div>
      </div>

      {picking && (
        <MonthPicker
          value={value}
          // 開いたときに出す年は、いま見えている月に合わせる
          focus={headMonth}
          max={max}
          activeDays={activeDays}
          onPick={(day) => {
            setPicking(false)
            onChange(day)
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}

function Nav({
  dir,
  onClick,
  disabled,
  onDark,
}: {
  dir: 'left' | 'right'
  onClick: () => void
  disabled?: boolean
  onDark?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'left' ? '前の週' : '次の週'}
      className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
        onDark
          ? 'text-white/75 hover:bg-white/15 hover:text-white disabled:text-white/35'
          : 'text-ink3 hover:bg-sunken hover:text-ink disabled:text-ink3/40'
      }`}
    >
      <Icon name={dir} size={16} />
    </button>
  )
}

/** その日から delta 日ずらした日付（YYYY-MM-DD） */
function shift(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

function min(a: string, b: string): string {
  return a < b ? a : b
}

/** その月の末日（YYYY-MM-DD）。翌月の0日目を数えると出る */
function endOfMonth(day: string): string {
  const y = Number(day.slice(0, 4))
  const m = Number(day.slice(5, 7))
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${day.slice(0, 7)}-${String(last).padStart(2, '0')}`
}
