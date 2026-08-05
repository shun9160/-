import { useCallback, useEffect, useState } from 'react'
import {
  createIngestToken,
  deleteIngestToken,
  fetchIngestTokens,
  type IngestToken,
} from '../lib/repo'
import { friendlyError } from '../lib/errors'
import {
  deletePasskey,
  listPasskeys,
  passkeyErrorMessage,
  passkeySupported,
  registerPasskey,
  type PasskeyItem,
} from '../lib/passkey'
import { fmtJst } from '../lib/timezone'
import Icon from './Icon'

interface Props {
  email: string | null
  onSignOut: () => Promise<void>
}

export default function AccountPanel({ email, onSignOut }: Props) {
  const [tokens, setTokens] = useState<IngestToken[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      setTokens(await fetchIngestTokens())
    } catch (e) {
      setErr(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function issue() {
    setBusy(true)
    setErr(null)
    try {
      await createIngestToken('MT5')
      await load()
    } catch (e) {
      setErr(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  async function revoke(token: string) {
    if (!confirm('この連携コードを無効にします。MT5からの自動送信は止まります。よろしいですか？'))
      return
    setBusy(true)
    try {
      await deleteIngestToken(token)
      await load()
    } catch (e) {
      setErr(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(token)
      setCopied(token)
      setTimeout(() => setCopied(null), 1800)
    } catch {
      setErr('コピーできませんでした。手で選択してコピーしてください。')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight">アカウント</h2>
        <p className="text-sm text-ink3">ログイン情報とMT5連携の設定</p>
      </div>

      {/* ログイン情報 */}
      <section className="card p-5">
        <p className="label">ログイン中</p>
        <p className="mt-1 text-base font-semibold">{email ?? '—'}</p>
        <p className="mt-1 text-xs text-ink3">
          取引データはこのアカウントにのみ保存され、他の人からは見えません
        </p>
        <button className="btn btn-quiet mt-4" onClick={onSignOut}>
          ログアウト
        </button>
      </section>

      <PasskeySection />

      {/* 連携コード */}
      <section className="card p-5">
        <h3 className="text-base font-bold">MT5との連携コード</h3>
        <p className="mt-1 text-sm text-ink2">
          MT5に入れるプログラム（EA）に、このコードを貼り付けます。
          コードだけで、あなたのアカウントに取引が届きます。
        </p>

        {err && (
          <p className="mt-3 whitespace-pre-wrap rounded-xl border border-down/25 bg-down-soft px-3 py-2 text-sm text-down">
            {err}
          </p>
        )}

        {loading ? (
          <p className="mt-4 text-sm text-ink3">読み込み中…</p>
        ) : tokens.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-line px-4 py-6 text-center">
            <p className="text-sm text-ink2">まだ発行していません</p>
            <button className="btn btn-primary mt-3" onClick={issue} disabled={busy}>
              <Icon name="plus" size={16} />
              連携コードを発行する
            </button>
          </div>
        ) : (
          <>
            <ul className="mt-4 flex flex-col gap-2">
              {tokens.map((t) => (
                <li key={t.token} className="rounded-2xl border border-line bg-sunken p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="flex-1 break-all font-mono text-sm font-bold tracking-wide">
                      {t.token}
                    </code>
                    <button className="btn btn-quiet shrink-0" onClick={() => copy(t.token)}>
                      {copied === t.token ? (
                        <>
                          <Icon name="check" size={15} />
                          コピー済み
                        </>
                      ) : (
                        'コピー'
                      )}
                    </button>
                    <button
                      className="btn btn-danger shrink-0 px-2"
                      onClick={() => revoke(t.token)}
                      aria-label="無効にする"
                      title="無効にする"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-ink3">
                    発行 {fmtJst(t.created_at, 'yyyy/MM/dd HH:mm')}
                    {' ・ '}
                    {t.last_used_at
                      ? `最終受信 ${fmtJst(t.last_used_at, 'yyyy/MM/dd HH:mm')}`
                      : 'まだ受信していません'}
                  </p>
                </li>
              ))}
            </ul>
            <button className="btn btn-quiet mt-3" onClick={issue} disabled={busy}>
              <Icon name="plus" size={16} />
              もう1つ発行する
            </button>
          </>
        )}

        <div className="mt-5 border-t border-line pt-4">
          <p className="label mb-1.5">MT5に入れる設定</p>
          <ul className="flex flex-col gap-1 text-sm text-ink2">
            <li>
              <span className="text-ink3">送信先URL：</span>
              <code className="rounded bg-sunken px-1.5 py-0.5 text-xs">
                {window.location.origin}/api/ingest
              </code>
            </li>
            <li>
              <span className="text-ink3">連携コード：</span>上のコード
            </li>
          </ul>
          <p className="mt-2 text-xs text-ink3">
            導入手順はリポジトリの <code className="rounded bg-sunken px-1">mt5/README.md</code>{' '}
            に書いてあります。
          </p>
        </div>
      </section>
    </div>
  )
}

/** 登録したパスキーに付ける名前（どの端末か分かるように） */
function deviceName(): string {
  const ua = navigator.userAgent
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android/i.test(ua)) return 'Android'
  if (/Mac/i.test(ua)) return 'Mac'
  if (/Windows/i.test(ua)) return 'Windows PC'
  return 'この端末'
}

/** パスキー（顔認証・指紋・PIN）の登録と削除 */
function PasskeySection() {
  const [items, setItems] = useState<PasskeyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const supported = passkeySupported()

  const load = useCallback(async () => {
    if (!supported) {
      setLoading(false)
      return
    }
    try {
      setItems(await listPasskeys())
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [supported])

  useEffect(() => {
    void load()
  }, [load])

  async function add() {
    setBusy(true)
    setErr(null)
    setDone(false)
    try {
      await registerPasskey(deviceName())
      setDone(true)
      await load()
    } catch (e) {
      setErr(passkeyErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('このパスキーを削除します。よろしいですか？')) return
    setBusy(true)
    try {
      await deletePasskey(id)
      await load()
    } catch (e) {
      setErr(passkeyErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-5">
      <h3 className="text-base font-bold">パスキー</h3>
      <p className="mt-1 text-sm text-ink2">
        顔認証・指紋・PINでログインできるようになります。パスワードの入力が不要になり、より安全です。
      </p>

      {!supported ? (
        <p className="mt-3 text-sm text-ink3">この端末・ブラウザでは利用できません。</p>
      ) : (
        <>
          {err && (
            <p className="mt-3 rounded-xl border border-down/25 bg-down-soft px-3 py-2 text-sm text-down">
              {err}
            </p>
          )}
          {done && (
            <p className="mt-3 flex items-center gap-1.5 rounded-xl border border-up/25 bg-up-soft px-3 py-2 text-sm text-up">
              <Icon name="check" size={15} />
              登録しました。次回からパスキーでログインできます
            </p>
          )}

          {loading ? (
            <p className="mt-4 text-sm text-ink3">読み込み中…</p>
          ) : items.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2">
              {items.map((k) => (
                <li
                  key={k.id}
                  className="flex items-center gap-2 rounded-2xl border border-line bg-sunken px-3 py-2.5"
                >
                  <Icon name="check" size={16} className="shrink-0 text-up" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {k.friendly_name || '登録済みのパスキー'}
                  </span>
                  {k.created_at && (
                    <span className="shrink-0 text-[11px] text-ink3">
                      {fmtJst(k.created_at, 'yyyy/MM/dd')}
                    </span>
                  )}
                  <button
                    className="btn btn-danger shrink-0 px-2"
                    onClick={() => remove(k.id)}
                    aria-label="削除"
                    disabled={busy}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink3">まだ登録されていません。</p>
          )}

          <button className="btn btn-primary mt-3" onClick={add} disabled={busy}>
            <Icon name="plus" size={16} />
            この端末のパスキーを登録
          </button>
        </>
      )}
    </section>
  )
}
