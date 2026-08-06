import { useMemo, useState } from 'react'
import Icon from '../Icon'
import type { Answers } from '../../lib/diagnosis/types'
import type { QuestionsPayload } from '../../lib/diagnosisClient'

interface Props {
  data: QuestionsPayload
  busy: boolean
  onSubmit: (answers: Answers) => void
  onCancel: () => void
}

/** 24問を4問ずつに区切って聞く */
export default function Questionnaire({ data, busy, onSubmit, onCancel }: Props) {
  const [answers, setAnswers] = useState<Answers>({})
  const [step, setStep] = useState(0)

  const perStep = data.perStep || 4
  const steps = useMemo(() => {
    const out: QuestionsPayload['questions'][] = []
    for (let i = 0; i < data.questions.length; i += perStep) {
      out.push(data.questions.slice(i, i + perStep))
    }
    return out
  }, [data.questions, perStep])

  const current = steps[step] ?? []
  const done = current.every((q) => answers[q.id] != null)
  const answered = Object.keys(answers).length
  const last = step === steps.length - 1

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between text-xs text-ink2">
          <span>
            {step + 1} / {steps.length}
          </span>
          <span>
            {answered} / {data.questions.length}問
          </span>
        </div>
        <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-sunken">
          <span
            className="block h-full rounded-full bg-brand transition-all"
            style={{ width: `${(answered / data.questions.length) * 100}%` }}
          />
        </span>
      </div>

      <ol className="flex flex-col gap-3">
        {current.map((q, i) => (
          <li key={q.id} className="card p-4">
            <p className="text-sm font-semibold leading-relaxed">
              <span className="mr-2 text-xs text-ink3">Q{step * perStep + i + 1}</span>
              {q.text}
            </p>
            <div className="mt-3 flex gap-1.5">
              {data.answerLabels.map((a) => {
                const on = answers[q.id] === a.value
                return (
                  <button
                    key={a.value}
                    type="button"
                    aria-pressed={on}
                    title={a.label}
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: a.value }))}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition-colors ${
                      on
                        ? 'border-brand bg-brand text-white'
                        : 'border-line bg-surface text-ink2 hover:bg-sunken'
                    }`}
                  >
                    {a.value}
                  </button>
                )
              })}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-ink3">
              <span>{data.answerLabels[0].label}</span>
              <span>{data.answerLabels[data.answerLabels.length - 1].label}</span>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex items-center justify-between gap-3">
        <button
          className="btn btn-ghost"
          onClick={() => (step === 0 ? onCancel() : setStep(step - 1))}
          disabled={busy}
        >
          <Icon name="left" size={16} />
          {step === 0 ? 'やめる' : '戻る'}
        </button>
        <button
          className="btn btn-primary"
          disabled={!done || busy}
          onClick={() => (last ? onSubmit(answers) : setStep(step + 1))}
        >
          {busy ? '採点中…' : last ? '診断する' : '次へ'}
          {!busy && <Icon name="right" size={16} />}
        </button>
      </div>

      {!done && (
        <p className="text-center text-xs text-ink3">このページの質問にすべて答えると次に進めます</p>
      )}
    </div>
  )
}
