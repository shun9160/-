import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Account, EnrichedTrade } from '../lib/types'
import { fetchTradeImageCounts } from '../lib/repo'
import { jstDayKey } from '../lib/timezone'
import DayScreen from './diary/DayScreen'
import JournalPage from './diary/JournalPage'
import DiaryAgenda from './diary/DiaryAgenda'

interface Props {
  trades: EnrichedTrade[]
  accounts?: Account[]
  dayNotes: Record<string, string>
  /** 日ごとの題名。一覧に出す */
  dayTitles?: Record<string, string>
  onChanged: () => void
  focusDay?: string | null
  readOnly?: boolean
  /** 記録タブへ */
  onAdd?: () => void
  /**
   * いま見ている日。横に振って日を移れるよう、外へ伝える。
   * 一覧を出しているあいだは null。日ではなく口座が動くようにする
   */
  onDayChange?: (day: string | null) => void
}

/**
 * 日記。
 *
 * 入口は日付が縦に流れる一覧。日を押すと、その日ぶんが
 * 1本の記事として画面いっぱいに開く（JournalPage）。
 */
export default function Diary({
  trades,
  accounts,
  dayNotes,
  dayTitles,
  onChanged,
  focusDay,
  readOnly,
  onAdd,
  onDayChange,
}: Props) {
  const today = useMemo(() => jstDayKey(new Date().toISOString()), [])

  // 取引のある最新日。今日の記録がまだ無くても、直前の日から見返せるようにする
  const latestTradeDay = useMemo(() => {
    let latest: string | null = null
    for (const t of trades) if (!latest || t.jstDay > latest) latest = t.jstDay
    return latest
  }, [trades])

  const [selected, setSelected] = useState<string>(focusDay ?? today)
  /**
   * 一覧を出しているか、その日を開いているか。
   * 入口は一覧にする。書いた日と書いていない日が並んで見えるほうが、
   * 日記として続けやすいため。ほかの画面から日を指定して来たときだけ、
   * いきなりその日を開く。
   */
  const [openDay, setOpenDay] = useState(!!focusDay)

  /**
   * 開く・閉じるときの動き。
   *
   * 閉じる動きを見せるには、消したあとも 200ms のあいだ中身を残しておく
   * 必要がある。だから「閉じた」と「閉じている最中」を別に持つ。
   * 動きが終わったら null に戻す。class を外さないと transform が
   * 残りっぱなしになり、中の position: fixed がこの箱を基準にしてしまう。
   */
  const [anim, setAnim] = useState<'in' | 'out' | null>(null)
  /** 押した場所（画面の上からの距離）。そこを軸に開く */
  const [originY, setOriginY] = useState(0)
  /** 日記が保存できているか。記事から上がってきて、画面の右上に出る */
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  /**
   * 動きの終わり。
   * 閉じ終わってはじめて中身を消す。先に消すと、閉じる動きが見えない。
   * class も外す。外さないと transform が残り、中の position: fixed が
   * この箱を基準にしてしまう。
   */
  const endAnim = useCallback(() => {
    window.clearTimeout(timer.current)
    setAnim((cur) => {
      if (cur === 'out') setOpenDay(false)
      return null
    })
  }, [])

  function open(day: string, y: number) {
    window.clearTimeout(timer.current)
    setSelected(day)
    setOriginY(y)
    setOpenDay(true)
    setAnim('in')
    timer.current = window.setTimeout(endAnim, 360)
  }

  function close() {
    window.clearTimeout(timer.current)
    setAnim('out')
    timer.current = window.setTimeout(endAnim, 260)
  }

  useEffect(() => {
    if (focusDay) {
      setSelected(focusDay)
      setOpenDay(true)
      setOriginY(0)
      setAnim('in')
    }
  }, [focusDay])

  // 今日にまだ何も無く、過去に記録があるなら、そちらを開いておく
  useEffect(() => {
    if (focusDay) return
    setSelected((cur) => {
      if (cur !== today) return cur
      const hasToday = trades.some((t) => t.jstDay === today) || dayNotes[today]
      return hasToday || !latestTradeDay ? cur : latestTradeDay
    })
    // 初回と、取引の読み込みが終わったときだけでよい
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestTradeDay])

  // 横に振って日を移れるよう、いま見ている日を外へ知らせる。
  // 一覧のときは知らせない（一覧で振っても日が動くのは分かりにくい）
  useEffect(() => {
    onDayChange?.(openDay ? selected : null)
  }, [selected, openDay, onDayChange])

  const dayTrades = useMemo(
    () => trades.filter((t) => t.jstDay === selected),
    [trades, selected],
  )
  const isToday = selected === today

  /** 日をずらす。カレンダーは「カレンダー」タブにあるので、ここでは前後の移動だけ */
  function shiftDay(delta: number) {
    const d = new Date(`${selected}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + delta)
    setSelected(d.toISOString().slice(0, 10))
  }

  // 一覧に「写真あり」を出すための枚数。重い画像そのものは読まない
  const [imageCounts, setImageCounts] = useState<Record<string, number>>({})
  useEffect(() => {
    fetchTradeImageCounts()
      .then(setImageCounts)
      .catch(() => {
        /* 数えられなくても一覧は出せる */
      })
  }, [trades.length])

  /** 動きの終わり。子の animation が上がってくることがあるので、自分のぶんだけ見る */
  function onAnimEnd(e: React.AnimationEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    endAnim()
  }

  /** 横に振って移れる日。明日から先へは行かせない */
  const swipeDays = [shiftDayKey(selected, -1), selected, shiftDayKey(selected, 1)].filter(
    (d) => d <= today,
  )

  return (
    <div>
      {/* 入口の一覧。開いている間も残しておく。
          後ろに残っているから、上にかぶさってくる動きが見える */}
      {/* 見出しは軽く。数と使い方は、すぐ下の帯が受け持つ */}
      <h2 className="mb-2.5 text-base font-bold">日記</h2>
      <DiaryAgenda
        trades={trades}
        dayNotes={dayNotes}
        dayTitles={dayTitles}
        imageCounts={imageCounts}
        today={today}
        onOpen={open}
      />

      {openDay && (
        <DayScreen
          day={selected}
          isToday={isToday}
          originY={originY}
          phase={anim}
          onClose={close}
          onAnimationEnd={onAnimEnd}
          onShiftDay={shiftDay}
          onToday={() => setSelected(today)}
          onAdd={onAdd}
          swipeDays={swipeDays}
          onPickDay={setSelected}
          saveState={saveState}
        >
          <JournalPage
            key={selected}
            day={selected}
            trades={dayTrades}
            accounts={accounts}
            readOnly={readOnly}
            onChanged={onChanged}
            onAdd={onAdd}
            onSaveState={setSaveState}
          />
        </DayScreen>
      )}
    </div>
  )
}

/** その日から delta 日ずらした日付（YYYY-MM-DD） */
function shiftDayKey(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}
