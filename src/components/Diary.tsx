import { useEffect, useMemo, useState } from 'react'
import type { Account, EnrichedTrade, TradeImage } from '../lib/types'
import { fetchRecentTradeImages, fetchTradeImageCounts } from '../lib/repo'
import { fetchLatest } from '../lib/diagnosisClient'
import type { DiagnosisResult } from '../lib/diagnosis/types'
import { jstDayKey } from '../lib/timezone'
import DayHeadline from './diary/DayHeadline'
import DayInsights from './diary/DayInsights'
import NoteCard from './diary/NoteCard'
import TypeCard from './diary/TypeCard'
import PerformanceCard from './diary/PerformanceCard'
import ScreenshotStrip from './diary/ScreenshotStrip'
import TradeSection from './diary/TradeSection'
import DiaryAgenda from './diary/DiaryAgenda'
import Icon from './Icon'

interface Props {
  trades: EnrichedTrade[]
  accounts?: Account[]
  dayNotes: Record<string, string>
  onChanged: () => void
  focusDay?: string | null
  readOnly?: boolean
  /** 記録タブへ */
  onAdd?: () => void
  /** 分析のタイプ診断へ */
  onOpenType?: () => void
  /** 分析へ */
  onStats?: () => void
  /**
   * いま見ている日。横に振って日を移れるよう、外へ伝える。
   * 一覧を出しているあいだは null。日ではなく口座が動くようにする
   */
  onDayChange?: (day: string | null) => void
}

/**
 * 日記。
 *
 * 「その日の成績」「振り返り」「その日の取引」を1画面にまとめる。
 * 広い画面は3列、狭い画面は1列。並び順は同じになるよう、
 * 置き場所だけをグリッドで指定している（DOMの順＝スマホでの順）。
 */
export default function Diary({
  trades,
  accounts,
  dayNotes,
  onChanged,
  focusDay,
  readOnly,
  onAdd,
  onOpenType,
  onStats,
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

  useEffect(() => {
    if (focusDay) {
      setSelected(focusDay)
      setOpenDay(true)
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

  // トレーダータイプ（診断していなければ null）
  const [diag, setDiag] = useState<DiagnosisResult | null>(null)
  const [diagLoading, setDiagLoading] = useState(true)
  useEffect(() => {
    let alive = true
    fetchLatest()
      .then((r) => alive && setDiag(r.diagnosis))
      .catch(() => {
        /* 診断の窓口が無くても日記は使える */
      })
      .finally(() => alive && setDiagLoading(false))
    return () => {
      alive = false
    }
  }, [])

  // 一覧に「写真あり」を出すための枚数。重い画像そのものは読まない
  const [imageCounts, setImageCounts] = useState<Record<string, number>>({})
  useEffect(() => {
    fetchTradeImageCounts()
      .then(setImageCounts)
      .catch(() => {
        /* 数えられなくても一覧は出せる */
      })
  }, [trades.length])

  // 最近貼ったチャート
  const [images, setImages] = useState<TradeImage[]>([])
  useEffect(() => {
    let alive = true
    fetchRecentTradeImages(6).then((r) => alive && setImages(r))
    return () => {
      alive = false
    }
  }, [trades.length])

  const timeOf = useMemo(() => {
    const m = new Map(trades.map((t) => [t.id, t.open_time]))
    return (id: string) => m.get(id) ?? null
  }, [trades])

  function openTrade(tradeId: string) {
    const t = trades.find((x) => x.id === tradeId)
    if (t) setSelected(t.jstDay)
  }

  const typeCard = (
    <TypeCard
      result={diag}
      loading={diagLoading}
      onOpen={() => onOpenType?.()}
    />
  )

  // 入口の一覧
  if (!openDay) {
    return (
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-bold">日記</h2>
          <span className="text-xs text-ink3">日を選ぶと書けます</span>
        </div>
        <DiaryAgenda
          trades={trades}
          dayNotes={dayNotes}
          imageCounts={imageCounts}
          today={today}
          onOpen={(d) => {
            setSelected(d)
            setOpenDay(true)
            window.scrollTo({ top: 0 })
          }}
        />
      </div>
    )
  }

  return (
    // 広い画面は「本文＋右側」の2列。
    // DOM の並びがそのままスマホでの並びになる。
    <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
      <button
        className="btn btn-ghost -ml-2 self-start xl:col-span-2"
        onClick={() => setOpenDay(false)}
      >
        <Icon name="back" size={17} />
        日記の一覧へ
      </button>

      <div className="flex flex-col gap-4">
        <DayHeadline
          day={selected}
          trades={dayTrades}
          isToday={isToday}
          onShiftDay={shiftDay}
          onToday={() => setSelected(today)}
          aside={
            <TypeCard
              result={diag}
              loading={diagLoading}
              compact
              onOpen={() => onOpenType?.()}
            />
          }
        />

        {dayTrades.length > 0 && (
          <DayInsights
            trades={dayTrades}
            note={dayNotes[selected]}
            onDetail={() => onStats?.()}
          />
        )}

        <NoteCard
          key={selected}
          day={selected}
          initial={dayNotes[selected] ?? ''}
          isToday={isToday}
          readOnly={readOnly}
          onChanged={onChanged}
        />

        <TradeSection
          trades={dayTrades}
          accounts={accounts}
          isToday={isToday}
          readOnly={readOnly}
          onChanged={onChanged}
          onAdd={onAdd}
        />
      </div>

      <div className="flex flex-col gap-4">
        {/* 診断済みなら狭い画面では上のカードに出ているので、ここでは広い画面だけ */}
        <div className={diag ? 'hidden xl:block' : ''}>{typeCard}</div>
        <PerformanceCard trades={trades} day={selected} />
        <ScreenshotStrip images={images} timeOf={timeOf} onOpenTrade={openTrade} />
      </div>
    </div>
  )
}
