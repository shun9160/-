import { useCallback, useEffect, useState } from 'react'
import Icon from '../Icon'
import Questionnaire from './Questionnaire'
import ResultView from './ResultView'
import HistoryList from './HistoryList'
import {
  calculate,
  completeAction,
  fetchDiagnosis,
  fetchHistory,
  fetchLatest,
  fetchQuestions,
  recalculate,
} from '../../lib/diagnosisClient'
import type { HistoryEntry, QuestionsPayload } from '../../lib/diagnosisClient'
import { DISCLAIMER, INTRO } from '../../lib/diagnosis/messages'
import { TYPES, TYPE_IDS } from '../../lib/diagnosis/types'
import type { Answers, DiagnosisResult, TypeId } from '../../lib/diagnosis/types'

type View = 'loading' | 'intro' | 'questions' | 'scoring' | 'result' | 'history'

interface Props {
  /** いま選んでいる口座。すべての口座なら null */
  accountId: string | null
}

export default function DiagnosisPanel({ accountId }: Props) {
  const [view, setView] = useState<View>('loading')
  const [questions, setQuestions] = useState<QuestionsPayload | null>(null)
  const [result, setResult] = useState<DiagnosisResult | null>(null)
  const [createdAt, setCreatedAt] = useState<string | undefined>()
  const [recheck, setRecheck] = useState<{ suggested: boolean; reasons: string[] } | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [answers, setAnswers] = useState<Answers>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const latest = await fetchLatest()
      if (latest.diagnosis) {
        setResult(latest.diagnosis)
        setCreatedAt(latest.createdAt)
        setRecheck(latest.recheck)
        setView('result')
      } else {
        setView('intro')
      }
    } catch (e) {
      setError((e as Error).message)
      setView('intro')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function start() {
    setError(null)
    setBusy(true)
    try {
      const q = questions ?? (await fetchQuestions())
      setQuestions(q)
      setView('questions')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function submit(a: Answers, tiebreak: TypeId | null = null) {
    setAnswers(a)
    setBusy(true)
    setError(null)
    setView('scoring')
    try {
      const res = await calculate(a, { accountId, tiebreak })
      setResult(res.diagnosis)
      setCreatedAt(res.createdAt)
      setRecheck(null)
      setView('result')
    } catch (e) {
      setError((e as Error).message)
      setView('questions')
    } finally {
      setBusy(false)
    }
  }

  async function recalc() {
    setBusy(true)
    setError(null)
    try {
      const res = await recalculate(accountId)
      setResult(res.diagnosis)
      setCreatedAt(res.createdAt)
      setRecheck(null)
      setView('result')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleAction(actionId: string, completed: boolean) {
    if (!result) return
    setBusy(true)
    try {
      const res = await completeAction(result.diagnosisId, actionId, completed)
      setResult(res.diagnosis)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function openHistory() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetchHistory()
      setHistory(res.history)
      setView('history')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function openOne(id: string) {
    setBusy(true)
    try {
      const res = await fetchDiagnosis(id)
      setResult(res.diagnosis)
      setCreatedAt(undefined)
      setRecheck(null)
      setView('result')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="card border-down/30 bg-down-soft px-4 py-3 text-sm text-down">{error}</p>
      )}

      {view === 'loading' && (
        <p className="card px-6 py-10 text-center text-sm text-ink3">読み込んでいます…</p>
      )}

      {view === 'intro' && <Intro busy={busy} onStart={start} onHistory={openHistory} />}

      {view === 'questions' && questions && (
        <Questionnaire
          data={questions}
          busy={busy}
          onSubmit={(a) => void submit(a)}
          onCancel={() => setView(result ? 'result' : 'intro')}
        />
      )}

      {view === 'scoring' && <Scoring />}

      {view === 'result' && result && (
        <>
          <ResultView
            result={result}
            createdAt={createdAt}
            recheck={recheck}
            busy={busy}
            onRetake={() => void start()}
            onRecalc={() => void recalc()}
            onToggleAction={(id, done) => void toggleAction(id, done)}
            onTiebreak={(t) => void submit(answers, t)}
          />
          <button className="btn btn-ghost self-start" onClick={() => void openHistory()}>
            <Icon name="book" size={16} />
            これまでの診断を見る
          </button>
        </>
      )}

      {view === 'history' && (
        <>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold">診断の履歴</h2>
            <button className="btn btn-ghost" onClick={() => setView(result ? 'result' : 'intro')}>
              <Icon name="back" size={16} />
              戻る
            </button>
          </div>
          <HistoryList history={history} onOpen={(id) => void openOne(id)} />
        </>
      )}
    </div>
  )
}

function Intro({
  busy,
  onStart,
  onHistory,
}: {
  busy: boolean
  onStart: () => void
  onHistory: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <section className="card p-5">
        <p className="text-[11px] font-bold tracking-[0.2em] text-ink3">TRADER TYPE</p>
        <h2 className="mt-1 text-2xl font-bold">{INTRO.title}</h2>
        <p className="mt-2 text-sm text-ink2">{INTRO.lead}</p>

        <ul className="mt-4 grid gap-2 sm:grid-cols-3">
          {TYPE_IDS.map((id) => {
            const t = TYPES[id]
            return (
              <li key={id} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                  style={{ background: t.color }}
                >
                  {id.slice(0, 2)}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold">{id}</span>
                  <span className="block truncate text-[10px] text-ink3">{t.category}</span>
                </span>
              </li>
            )
          })}
        </ul>

        <h3 className="mt-5 text-sm font-bold">使うデータについて</h3>
        <ul className="mt-1.5 flex flex-col gap-1">
          {INTRO.dataUse.map((d) => (
            <li key={d} className="text-xs text-ink2">
              ・{d}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={onStart} disabled={busy}>
            <Icon name="sparkle" size={16} />
            24問の診断をはじめる
          </button>
          <button className="btn btn-ghost border border-line" onClick={onHistory} disabled={busy}>
            履歴を見る
          </button>
        </div>
      </section>

      <p className="text-[11px] leading-relaxed text-ink3">{DISCLAIMER}</p>
    </div>
  )
}

const STEPS = ['回答を読み取っています', '取引の記録を集めています', 'タイプごとに点数を出しています']

function Scoring() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % STEPS.length), 900)
    return () => clearInterval(t)
  }, [])
  return (
    <section className="card flex flex-col items-center gap-4 px-6 py-12">
      <span className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-brand-soft" />
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white">
          <Icon name="sparkle" size={22} />
        </span>
      </span>
      <p className="text-sm font-semibold text-ink2">{STEPS[i]}</p>
      <span className="block h-1.5 w-40 overflow-hidden rounded-full bg-sunken">
        <span className="block h-full w-1/3 animate-pulse rounded-full bg-brand" />
      </span>
    </section>
  )
}
