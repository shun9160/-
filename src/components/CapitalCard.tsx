import { useRef, useState } from 'react'
import type { Account } from '../lib/types'
import { accountLabel } from '../lib/types'
import { friendlyError } from '../lib/errors'
import { fileToDownscaledDataUrl } from '../lib/image'
import { getAccountCapitalScreenshot, saveAccountCapital } from '../lib/repo'
import { colorOf, fmtMoney, fmtPct } from '../lib/format'
import { currencyLabel } from '../lib/appConfig'
import Icon from './Icon'

interface Props {
  /** 表示中の口座。「すべて」を選んでいるときは null */
  account: Account | null
  /** 「すべて」のとき合算に使う口座の一覧 */
  accounts: Account[]
  /** 累計純損益（手数料込み） */
  netTotal: number
  onChanged: () => void
  readOnly?: boolean
}

export default function CapitalCard({ account, accounts, netTotal, onChanged, readOnly }: Props) {
  const [editing, setEditing] = useState(false)

  // 「すべて」のときは各口座の原資を足す。
  // ただし通貨が混ざっていると足せないので、その場合は原資を出さない。
  const mixedCurrency =
    account == null && new Set(accounts.map((a) => a.currency)).size > 1
  const capital = account
    ? account.initial_capital
    : mixedCurrency
      ? 0
      : accounts.reduce((s, a) => s + a.initial_capital, 0)
  const hasCapital = capital > 0
  const balance = capital + netTotal
  const rate = hasCapital ? netTotal / capital : null

  if (editing && account) {
    return (
      <section className="card p-5">
        <h3 className="text-base font-bold">原資を設定する</h3>
        <p className="mt-0.5 text-sm text-ink2">
          {accountLabel(account)} に最初に入金した金額です。入れると増減率と残高が出ます。
        </p>
        <div className="mt-4">
          <CapitalForm
            account={account}
            onDone={() => {
              setEditing(false)
              onChanged()
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      </section>
    )
  }

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">
            {account ? accountLabel(account) : 'すべての口座'}
            <span className="mx-1.5">·</span>
            {hasCapital ? '現在の残高' : '累計損益（手数料込み）'}
          </p>
          <p className="mt-1 text-hero font-bold tabular-nums">
            {hasCapital ? fmtMoney(balance) : fmtMoney(netTotal, { sign: true })}
            <span className="ml-1.5 text-base font-semibold text-ink3">{currencyLabel()}</span>
          </p>
        </div>
        {!readOnly && account && (
          <button
            className="btn btn-quiet shrink-0"
            onClick={() => setEditing(true)}
            aria-label="原資を編集"
          >
            <Icon name="pencil" size={16} />
            原資
          </button>
        )}
      </div>

      {hasCapital ? (
        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
          <div>
            <dt className="text-xs text-ink3">原資</dt>
            <dd className="mt-0.5 text-lg font-bold tabular-nums">{fmtMoney(capital)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink3">増減</dt>
            <dd className={`mt-0.5 text-lg font-bold tabular-nums ${colorOf(netTotal)}`}>
              {fmtMoney(netTotal, { sign: true })}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink3">増減率</dt>
            <dd className={`mt-0.5 text-lg font-bold tabular-nums ${colorOf(netTotal)}`}>
              {rate != null ? (rate > 0 ? '+' : '') + fmtPct(rate) : '—'}
            </dd>
          </div>
        </dl>
      ) : mixedCurrency ? (
        <p className="mt-3 rounded-xl border border-dashed border-line px-3 py-2.5 text-xs text-ink2">
          通貨のちがう口座が混ざっているため、原資と残高はまとめて出せません。
          口座を1つ選ぶと表示されます。
        </p>
      ) : (
        !readOnly &&
        account && (
          <button
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2.5 text-sm font-semibold text-ink2 hover:bg-sunken"
            onClick={() => setEditing(true)}
          >
            <Icon name="plus" size={16} />
            原資を登録すると増減率が出ます
          </button>
        )
      )}

      {account?.capital_note && <p className="mt-2 text-xs text-ink3">{account.capital_note}</p>}
    </section>
  )
}

/** 原資の入力フォーム（手入力＋スクショ添付） */
function CapitalForm({
  account,
  onDone,
  onCancel,
}: {
  account: Account
  onDone: () => void
  onCancel: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [amount, setAmount] = useState(
    account.initial_capital ? String(account.initial_capital) : '',
  )
  const [note, setNote] = useState(account.capital_note ?? '')
  const [shot, setShot] = useState<string | null | undefined>(undefined)
  const [preview, setPreview] = useState<string | null>(null)
  const [loadingShot, setLoadingShot] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErr(null)
    try {
      const url = await fileToDownscaledDataUrl(file)
      setShot(url)
      setPreview(url)
    } catch (e) {
      setErr(friendlyError(e))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function showExisting() {
    setLoadingShot(true)
    setErr(null)
    try {
      const url = await getAccountCapitalScreenshot(account.id)
      setPreview(url)
      if (!url) setErr('画像は登録されていません')
    } catch (e) {
      setErr(friendlyError(e))
    } finally {
      setLoadingShot(false)
    }
  }

  async function submit() {
    const n = Number(amount)
    if (!(n >= 0) || amount.trim() === '') {
      setErr('原資の金額を入力してください')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await saveAccountCapital(account.id, {
        initial_capital: n,
        capital_note: note.trim() || null,
        ...(shot !== undefined ? { capital_screenshot: shot } : {}),
      })
      onDone()
    } catch (e) {
      setErr(friendlyError(e))
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="label">原資（{currencyLabel()}）</span>
        <input
          className="input tabular-nums text-lg font-bold"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100000"
          inputMode="decimal"
          autoFocus
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="label">メモ（任意）</span>
        <input
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="2026年8月に入金"
        />
      </label>

      <div>
        <p className="label mb-1.5">入金画面のスクショ（任意）</p>
        {preview ? (
          <div className="overflow-hidden rounded-2xl border border-line">
            <img src={preview} alt="原資の記録" className="max-h-64 w-full bg-sunken object-contain" />
            <div className="flex gap-1.5 border-t border-line p-2">
              <button className="btn btn-quiet" type="button" onClick={() => fileRef.current?.click()}>
                差し替え
              </button>
              <button
                className="btn btn-danger ml-auto"
                type="button"
                onClick={() => {
                  setShot(null)
                  setPreview(null)
                }}
              >
                削除
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-quiet" type="button" onClick={() => fileRef.current?.click()}>
              <Icon name="camera" size={17} />
              画像を選ぶ
            </button>
            {shot === undefined && (
              <button className="btn btn-ghost" type="button" onClick={showExisting} disabled={loadingShot}>
                {loadingShot ? '読み込み中…' : '登録済みの画像を見る'}
              </button>
            )}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
      </div>

      {err && (
        <p className="whitespace-pre-wrap rounded-xl border border-down/25 bg-down-soft px-3 py-2 text-sm text-down">
          {err}
        </p>
      )}

      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={submit} disabled={busy} type="button">
          {busy ? '保存中…' : '保存'}
        </button>
        <button className="btn btn-ghost" onClick={onCancel} type="button">
          キャンセル
        </button>
      </div>
    </div>
  )
}
