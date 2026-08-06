import { useState } from 'react'
import type { Account } from '../lib/types'
import { accountLabel } from '../lib/types'
import type { AccountInput } from '../lib/repo'
import { createAccount, deleteAccount, setDefaultAccount, updateAccount } from '../lib/repo'
import { friendlyError } from '../lib/errors'
import Icon from './Icon'
import { Pill, SectionHeader } from './ui'

interface Props {
  accounts: Account[]
  /** 口座ごとの取引数 */
  countOf: (id: string) => number
  onChanged: () => void
  readOnly?: boolean
}

export default function AccountsPanel({ accounts, countOf, onChanged, readOnly }: Props) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function makeDefault(id: string) {
    try {
      await setDefaultAccount(id)
      onChanged()
    } catch (e) {
      setErr(friendlyError(e))
    }
  }

  async function remove(a: Account) {
    const n = countOf(a.id)
    const msg =
      n > 0
        ? `「${accountLabel(a)}」を削除します。この口座の取引 ${n}件も一緒に消えます。よろしいですか？`
        : `「${accountLabel(a)}」を削除します。よろしいですか？`
    if (!confirm(msg)) return
    try {
      await deleteAccount(a.id)
      onChanged()
    } catch (e) {
      setErr(friendlyError(e))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader
        title="口座"
        sub={`${accounts.length}件`}
        actions={
          !readOnly && editing !== 'new' ? (
            <button className="btn btn-quiet" onClick={() => setEditing('new')}>
              <Icon name="plus" size={16} />
              口座を追加
            </button>
          ) : undefined
        }
      />

      {err && (
        <p className="whitespace-pre-wrap rounded-xl border border-down/25 bg-down-soft px-3 py-2 text-sm text-down">
          {err}
        </p>
      )}

      {editing === 'new' && (
        <div className="card p-4">
          <h3 className="mb-3 text-base font-bold">口座を追加する</h3>
          <AccountForm
            onSubmit={async (patch) => {
              await createAccount(patch)
              setEditing(null)
              onChanged()
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {accounts.length === 0 && editing !== 'new' && (
        <p className="card px-6 py-8 text-center text-sm text-ink3">
          口座がまだありません。「口座を追加」から、ブローカー名と口座番号を登録してください。
        </p>
      )}

      {accounts.map((a) => (
        <article key={a.id} className="card p-4">
          {editing === a.id ? (
            <>
              <h3 className="mb-3 text-base font-bold">口座を編集する</h3>
              <AccountForm
                account={a}
                onSubmit={async (patch) => {
                  await updateAccount(a.id, patch)
                  setEditing(null)
                  onChanged()
                }}
                onCancel={() => setEditing(null)}
              />
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold">{accountLabel(a)}</h3>
                    {a.is_default && <Pill tone="brand">記録先</Pill>}
                  </div>
                  <p className="mt-0.5 text-sm text-ink2">
                    {a.broker || 'ブローカー未設定'}
                    <span className="mx-1.5">·</span>
                    口座番号 {a.login || '未設定'}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-ink3">{countOf(a.id)}件</span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 sm:grid-cols-4">
                <Cell label="通貨" value={a.currency} />
                <Cell label="1ロット" value={`${a.lot_size.toLocaleString('ja-JP')}通貨`} />
                <Cell
                  label="時差"
                  value={`UTC${a.broker_utc_offset >= 0 ? '+' : ''}${a.broker_utc_offset}`}
                />
                <Cell label="原資" value={a.initial_capital.toLocaleString('ja-JP')} />
              </dl>

              {!readOnly && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                  <button className="btn btn-quiet" onClick={() => setEditing(a.id)}>
                    <Icon name="pencil" size={16} />
                    編集
                  </button>
                  {!a.is_default && (
                    <button className="btn btn-ghost" onClick={() => makeDefault(a.id)}>
                      記録先にする
                    </button>
                  )}
                  <button
                    className="btn btn-danger ml-auto px-2"
                    onClick={() => remove(a)}
                    aria-label="この口座を削除"
                    title="削除"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </article>
      ))}
    </div>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-ink3">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  )
}

/** 口座の入力フォーム。追加と編集で共通に使う。 */
function AccountForm({
  account,
  onSubmit,
  onCancel,
}: {
  account?: Account
  onSubmit: (patch: AccountInput) => Promise<void>
  onCancel: () => void
}) {
  const [broker, setBroker] = useState(account?.broker ?? '')
  const [login, setLogin] = useState(account?.login ?? '')
  const [nickname, setNickname] = useState(account?.nickname ?? '')
  const [currency, setCurrency] = useState(account?.currency ?? 'JPY')
  const [lotSize, setLotSize] = useState(String(account?.lot_size ?? 100000))
  const [offset, setOffset] = useState(String(account?.broker_utc_offset ?? 4))
  const [capital, setCapital] = useState(String(account?.initial_capital ?? ''))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    if (!broker.trim() && !login.trim() && !nickname.trim()) {
      setErr('ブローカー名か口座番号のどちらかは入れてください')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await onSubmit({
        broker: broker.trim() || null,
        login: login.trim() || null,
        nickname: nickname.trim() || null,
        currency,
        lot_size: Number(lotSize) || 100000,
        broker_utc_offset: Number(offset) || 0,
        initial_capital: Number(capital) || 0,
      })
    } catch (e) {
      setErr(friendlyError(e))
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ブローカー名" value={broker} onChange={setBroker} placeholder="Exness" />
        <Field label="口座番号" value={login} onChange={setLogin} placeholder="12345678" />
      </div>
      <Field
        label="表示名（任意）"
        value={nickname}
        onChange={setNickname}
        placeholder="入れると一覧でこの名前になります"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="label">通貨</span>
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="JPY">日本円 (JPY)</option>
            <option value="USD">米ドル (USD)</option>
            <option value="EUR">ユーロ (EUR)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">MT5サーバーの時差</span>
          <select className="input" value={offset} onChange={(e) => setOffset(e.target.value)}>
            <option value="4">UTC+4（ドバイ・多くの海外業者）</option>
            <option value="3">UTC+3（夏時間の業者）</option>
            <option value="2">UTC+2（欧州冬時間）</option>
            <option value="9">UTC+9（日本時間と同じ）</option>
            <option value="0">UTC+0</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="1ロットの通貨量"
          value={lotSize}
          onChange={setLotSize}
          placeholder="100000"
          numeric
        />
        <Field label="原資" value={capital} onChange={setCapital} placeholder="100000" numeric />
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  numeric,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  numeric?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <input
        className={`input ${numeric ? 'tabular-nums' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={numeric ? 'decimal' : undefined}
      />
    </label>
  )
}
