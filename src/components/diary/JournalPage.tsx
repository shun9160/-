import { useEffect, useState } from 'react'
import type { Account, EnrichedTrade } from '../../lib/types'
import type { DayEntry } from '../../lib/journal'
import { emptyEntry, isEmpty, plainText } from '../../lib/journal'
import { fetchDayEntry, saveDayEntry } from '../../lib/repo'
import { demoDayEntries } from '../../lib/demo'
import { useAutoSave } from '../../hooks/useAutoSave'
import type { SaveStatus } from '../../hooks/useAutoSave'
import { fmtJst } from '../../lib/timezone'
import AutoTextarea from '../AutoTextarea'
import Icon from '../Icon'
import DayCharts from './DayCharts'
import JournalWriter from './JournalWriter'
import EmotionPicker from './EmotionPicker'
import DayInsights from './DayInsights'
import TradeEmbed, { Rule } from './TradeEmbed'

/**
 * 一日ぶんの日記を、1本の記事として書く・読むところ。
 *
 * 作りの決まりごと:
 *  - 入力欄を並べない。ページそのものに書いている感じにする
 *  - 数字は人に書かせない。取り込んだ履歴から出す
 *  - 「保存する」ボタンを置かない。書いたそばから勝手に保存する
 *  - トレード結果を上に置かない。主役はその日の自分の言葉
 *
 * 上から:
 *   日付 → チャート → 題名 → 本文 → 気持ち
 *   → 今日のトレード(自動) → 振り返り → 今日の学び
 */

interface Props {
  day: string
  trades: EnrichedTrade[]
  accounts?: Account[]
  readOnly?: boolean
  /**
   * サンプル表示中か。
   *
   * 読み書きできないこと（readOnly）とは別に持つ。こちらは
   * 「どこから中身を読むか」の話で、サンプルのときは
   * データベースではなく、同梱の見本から読む
   */
  demo?: boolean
  onChanged: () => void
  onAdd?: () => void
  /** 保存の様子を上に出すため、外へ伝える */
  onSaveState?: (status: SaveStatus) => void
}

export default function JournalPage({
  day,
  trades,
  accounts,
  readOnly,
  demo,
  onChanged,
  onAdd,
  onSaveState,
}: Props) {
  const [entry, setEntry] = useState<DayEntry>(() => emptyEntry(day))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)

    if (demo) {
      setEntry(demoDayEntries()[day] ?? emptyEntry(day))
      setLoading(false)
      return
    }

    fetchDayEntry(day)
      .then((e) => alive && setEntry(e))
      .catch(() => alive && setEntry(emptyEntry(day)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [day, demo])

  const status = useAutoSave(entry, saveDayEntry, {
    paused: loading || !!readOnly,
    // 開いただけの日に、空の行を作らない
    skip: isEmpty,
  })

  useEffect(() => {
    onSaveState?.(status)
  }, [status, onSaveState])

  function set<K extends keyof DayEntry>(key: K, value: DayEntry[K]) {
    setEntry((e) => ({ ...e, [key]: value }))
  }

  const iso = `${day}T00:00:00+09:00`
  const hasReflection = !!(entry.good || entry.improve || entry.nextTime)


  return (
    <article className="mx-auto max-w-[42rem]">
      {/* 日付。記事の日付なので、小さく置くだけ */}
      <header>
        <p className="text-[13px] font-bold tabular-nums tracking-wide text-brand">
          {fmtJst(iso, 'yyyy.MM.dd')}
        </p>
        <p className="mt-0.5 text-[12px] text-ink3">{fmtJst(iso, 'EEEE')}</p>
      </header>

      {/* その日のチャート。文字より先に、見た絵から思い出せるように。
          取引に添付した画像は持ってこない。ここは自分で選んで貼る場所 */}
      <div className="mt-4">
        <DayCharts
          photos={entry.photos}
          onChange={(p) => set('photos', p)}
          readOnly={readOnly}
        />
      </div>

      {/* 題名と本文。中で1枚の紙としてつながっている */}
      <div className="mt-6">
        <JournalWriter
          title={entry.title}
          onTitleChange={(v) => set('title', v)}
          blocks={entry.blocks}
          onBlocksChange={(b) => set('blocks', b)}
          readOnly={readOnly}
        />
      </div>

      <EmotionPicker
        value={entry.emotions}
        onChange={(v) => set('emotions', v)}
        why={entry.emotionWhy}
        onWhyChange={(v) => set('emotionWhy', v)}
        readOnly={readOnly}
      />

      {/* ここだけは自分では書かない。取り込んだ履歴から出る */}
      <TradeEmbed
        trades={trades}
        accounts={accounts}
        readOnly={readOnly}
        onChanged={onChanged}
        onAdd={onAdd}
      />

      {/* 事実をひとつ見てから振り返れるように、問いの直前に置く */}
      <DayInsights trades={trades} note={plainText(entry.blocks)} />

      {/* 振り返り。問いに答える形にするのは、
          白紙だと「今日は普通だった」で終わってしまうため */}
      {(!readOnly || hasReflection) && (
        <section className="mt-10">
          <Rule />
          <h2 className="mt-6 text-lg font-bold">振り返り</h2>

          <Prompt
            q="今日いちばん良かった判断は？"
            value={entry.good}
            onChange={(v) => set('good', v)}
            placeholder="待つと決めた場所まで、ちゃんと待てた。"
            readOnly={readOnly}
          />
          <Prompt
            q="改善するとしたら？"
            value={entry.improve}
            onChange={(v) => set('improve', v)}
            placeholder="含み益が減るのが怖くて、予定より早く閉じた。"
            readOnly={readOnly}
          />
          <Prompt
            q="もう一度同じ相場が来たら？"
            value={entry.nextTime}
            onChange={(v) => set('nextTime', v)}
            placeholder="同じ場所で入って、決めた場所まで持つ。"
            readOnly={readOnly}
          />
        </section>
      )}

      {/* 今日の学び。あとから集めて読み返せるように、別に持っている */}
      {(!readOnly || entry.lesson) && (
        <section className="mt-10">
          <Rule />
          <div className="mt-6 rounded-2xl bg-brand-soft px-5 py-5">
            <h2 className="flex items-center gap-1.5 text-[13px] font-bold text-brand">
              <Icon name="bulb" size={14} />
              今日の学び
            </h2>
            {readOnly ? (
              <p className="mt-2 whitespace-pre-wrap text-[17px] font-semibold leading-[1.8]">
                {entry.lesson}
              </p>
            ) : (
              <AutoTextarea
                value={entry.lesson}
                onChange={(e) => set('lesson', e.target.value)}
                placeholder="動いた相場を追いかけない。自分が決めた場所まで待つ。"
                className="mt-2 text-[17px] font-semibold leading-[1.8]"
                minHeight={56}
              />
            )}
            {!readOnly && (
              <p className="mt-2 text-[11px] text-brand/70">
                ここに書いたことは、あとから学びだけを並べて読み返せます
              </p>
            )}
          </div>
        </section>
      )}

      {readOnly && (
        <p className="mt-8 text-center text-[12px] text-ink3">
          サンプル表示中は書き込めません
        </p>
      )}
    </article>
  )
}

/** 振り返りの問いひとつ。答えは記事の続きとして書く */
function Prompt({
  q,
  value,
  onChange,
  placeholder,
  readOnly,
}: {
  q: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  readOnly?: boolean
}) {
  if (readOnly && !value) return null
  return (
    <div className="mt-5">
      <p className="text-[13px] font-bold text-ink2">{q}</p>
      {readOnly ? (
        <p className="mt-1 whitespace-pre-wrap text-[16px] leading-[1.95]">{value}</p>
      ) : (
        <AutoTextarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1 text-[16px] leading-[1.95]"
          minHeight={34}
        />
      )}
    </div>
  )
}
