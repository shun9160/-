import { useState } from 'react'
import { saveOnboarding } from '../lib/repo'
import { friendlyError } from '../lib/errors'
import { BRAND } from '../lib/brand'
import Logo from './Logo'
import Icon from './Icon'

interface Props {
  onDone: () => void
}

interface Answers {
  account_currency: string
  initial_capital: string
  lot_size: string
  broker_utc_offset: string
  main_symbol: string
}

const STEPS = ['通貨', '原資', 'ロット', '時差', '銘柄'] as const

export default function Onboarding({ onDone }: Props) {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [a, setA] = useState<Answers>({
    account_currency: 'JPY',
    initial_capital: '',
    lot_size: '100000',
    broker_utc_offset: '4',
    main_symbol: 'XAUUSD',
  })

  const set = (k: keyof Answers, v: string) => setA((prev) => ({ ...prev, [k]: v }))

  function next() {
    setErr(null)
    if (step === 1 && !(Number(a.initial_capital) >= 0 && a.initial_capital.trim() !== '')) {
      setErr('金額を入力してください（0でも構いません）')
      return
    }
    if (step < STEPS.length - 1) setStep(step + 1)
    else void finish()
  }

  async function finish() {
    setBusy(true)
    setErr(null)
    try {
      await saveOnboarding({
        initial_capital: Number(a.initial_capital) || 0,
        account_currency: a.account_currency,
        lot_size: Number(a.lot_size) || 100000,
        broker_utc_offset: Number(a.broker_utc_offset) || 0,
        main_symbol: a.main_symbol.trim() || null,
      })
      onDone()
    } catch (e) {
      setErr(friendlyError(e))
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-5 py-8">
      <header className="flex items-center justify-between">
        <Logo size={28} />
        <button className="btn btn-ghost text-sm" onClick={onDone}>
          あとで
        </button>
      </header>

      {/* 進み具合 */}
      <div className="mt-8 flex gap-1.5" aria-label={`${step + 1} / ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1">
            <div
              className={`h-1 rounded-full transition-colors ${
                i <= step ? 'bg-brand' : 'bg-line'
              }`}
            />
            <span
              className={`mt-1.5 block text-[10px] font-semibold ${
                i === step ? 'text-brand' : 'text-ink3'
              }`}
            >
              {s}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-1 flex-col justify-center py-8">
        {step === 0 && (
          <Question
            title="口座の通貨はどれですか？"
            hint="損益をこの通貨で表示します"
          >
            <Choices
              value={a.account_currency}
              onChange={(v) => set('account_currency', v)}
              options={[
                { value: 'JPY', label: '日本円', sub: 'JPY' },
                { value: 'USD', label: '米ドル', sub: 'USD' },
                { value: 'EUR', label: 'ユーロ', sub: 'EUR' },
              ]}
            />
          </Question>
        )}

        {step === 1 && (
          <Question
            title="原資はいくらですか？"
            hint="最初に入金した金額です。増減率の計算に使います"
          >
            <div className="relative">
              <input
                className="input py-4 text-2xl font-semibold tabular-nums"
                value={a.initial_capital}
                onChange={(e) => set('initial_capital', e.target.value)}
                placeholder="100000"
                inputMode="decimal"
                autoFocus
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink3">
                {a.account_currency}
              </span>
            </div>
            <p className="mt-2 text-xs text-ink3">あとから変更できます</p>
          </Question>
        )}

        {step === 2 && (
          <Question
            title="1ロットは何通貨ですか？"
            hint="多くのブローカーは10万通貨（標準ロット）です"
          >
            <Choices
              value={a.lot_size}
              onChange={(v) => set('lot_size', v)}
              options={[
                { value: '100000', label: '10万通貨', sub: '標準ロット・最も一般的' },
                { value: '10000', label: '1万通貨', sub: 'ミニロット' },
                { value: '1000', label: '1千通貨', sub: 'マイクロロット' },
              ]}
            />
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-ink2">
                その他の数値を入れる
              </summary>
              <input
                className="input mt-2 tabular-nums"
                value={a.lot_size}
                onChange={(e) => set('lot_size', e.target.value)}
                inputMode="decimal"
              />
            </details>
          </Question>
        )}

        {step === 3 && (
          <Question
            title="MT5の時刻は日本時間と何時間ずれていますか？"
            hint="MT5に表示される時刻を、日本時間に直すために使います"
          >
            <Choices
              value={a.broker_utc_offset}
              onChange={(v) => set('broker_utc_offset', v)}
              options={[
                { value: '4', label: '日本より5時間おそい', sub: 'ドバイ時間 (UTC+4)・多くの海外業者' },
                { value: '3', label: '日本より6時間おそい', sub: 'UTC+3・夏時間の業者に多い' },
                { value: '2', label: '日本より7時間おそい', sub: 'UTC+2・欧州冬時間' },
                { value: '9', label: '日本時間と同じ', sub: 'UTC+9・国内業者' },
              ]}
            />
            <p className="mt-3 text-xs text-ink3">
              わからない場合は、そのままで大丈夫です。MT5から自動連携すると、この設定は使われません。
            </p>
          </Question>
        )}

        {step === 4 && (
          <Question
            title="主に取引する銘柄は？"
            hint="入力画面の初期値に使います"
          >
            <Choices
              value={a.main_symbol}
              onChange={(v) => set('main_symbol', v)}
              options={[
                { value: 'XAUUSD', label: 'ゴールド', sub: 'XAUUSD' },
                { value: 'USDJPY', label: 'ドル円', sub: 'USDJPY' },
                { value: 'EURUSD', label: 'ユーロドル', sub: 'EURUSD' },
              ]}
            />
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-ink2">
                別の銘柄を入れる
              </summary>
              <input
                className="input mt-2"
                value={a.main_symbol}
                onChange={(e) => set('main_symbol', e.target.value)}
                placeholder="XAUUSD.raw"
              />
            </details>
          </Question>
        )}

        {err && (
          <p className="mt-4 rounded-xl border border-down/25 bg-down-soft px-3 py-2 text-sm text-down">
            {err}
          </p>
        )}
      </div>

      <footer className="flex items-center gap-2">
        {step > 0 && (
          <button className="btn btn-quiet" onClick={() => setStep(step - 1)} disabled={busy}>
            <Icon name="left" size={16} />
            戻る
          </button>
        )}
        <button className="btn btn-primary flex-1" onClick={next} disabled={busy}>
          {busy ? '保存中…' : step === STEPS.length - 1 ? 'はじめる' : '次へ'}
          {!busy && step < STEPS.length - 1 && <Icon name="right" size={16} />}
        </button>
      </footer>

      <p className="mt-4 text-center text-xs text-ink3">{BRAND.tagline}</p>
    </div>
  )
}

function Question({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold leading-snug tracking-tight text-balance">{title}</h1>
      <p className="mt-1.5 text-sm text-ink2">{hint}</p>
      <div className="mt-6">{children}</div>
    </div>
  )
}

function Choices({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string; sub: string }[]
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((o) => {
        const on = value === o.value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
              on ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:bg-sunken'
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                on ? 'border-brand bg-brand text-white' : 'border-line'
              }`}
            >
              {on && <Icon name="check" size={12} strokeWidth={3} />}
            </span>
            <span className="min-w-0">
              <span className={`block font-semibold ${on ? 'text-brand' : 'text-ink'}`}>
                {o.label}
              </span>
              <span className="block text-xs text-ink2">{o.sub}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
