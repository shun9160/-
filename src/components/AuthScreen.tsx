import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import { BRAND } from '../lib/brand'
import { passkeyErrorMessage, passkeySupported, signInWithPasskey } from '../lib/passkey'
import Logo from './Logo'
import Icon from './Icon'

type Mode = 'signin' | 'signup'

interface Props {
  /** ログインせずにサンプルを見る */
  onSkip?: () => void
}

export default function AuthScreen({ onSkip }: Props) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const hasPasskey = passkeySupported()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setErr(null)
    setInfo(null)

    if (!email.trim()) return setErr('メールアドレスを入力してください')
    if (password.length < 6) return setErr('パスワードは6文字以上にしてください')

    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })
        if (error) throw error
        if (!data.session) {
          setInfo('確認メールを送りました。メール内のリンクを開くと登録が完了します。')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error
      }
    } catch (e) {
      setErr(translateAuthError(e))
    } finally {
      setBusy(false)
    }
  }

  async function passkeyLogin() {
    setErr(null)
    setInfo(null)
    setPasskeyBusy(true)
    try {
      await signInWithPasskey()
    } catch (e) {
      setErr(passkeyErrorMessage(e))
    } finally {
      setPasskeyBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line px-5 py-4">
        <div className="mx-auto max-w-4xl">
          <Logo size={30} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-5 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">ログイン</h1>
          <p className="mt-1 text-sm text-ink2">{BRAND.tagline}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr] md:gap-8">
          {/* 左：パスキー */}
          <section className="card p-6">
            <h2 className="text-base font-bold">パスキーでログイン</h2>
            <p className="mt-1 text-sm text-ink2">
              端末の顔認証・指紋・PINで入ります。パスワードを覚える必要がありません。
            </p>

            <div className="my-6 flex items-center justify-center gap-6" aria-hidden="true">
              <BioIcon label="顔認証">
                <circle cx="12" cy="12" r="9" />
                <path d="M9 10.5v.5M15 10.5v.5M8.8 14.5a4.2 4.2 0 0 0 6.4 0" />
              </BioIcon>
              <BioIcon label="指紋">
                <path d="M12 4.5c-3 0-5.5 2.4-5.5 5.4v3.3M12 4.5c3 0 5.5 2.4 5.5 5.4v5.4" />
                <path d="M9.2 10c0-1.5 1.3-2.8 2.8-2.8s2.8 1.3 2.8 2.8v6.5" />
                <path d="M12 10.3v6.4M6.7 17.2v1.6M17.4 18v1" />
              </BioIcon>
              <BioIcon label="PIN">
                <circle cx="8" cy="8" r="1.2" />
                <circle cx="12" cy="8" r="1.2" />
                <circle cx="16" cy="8" r="1.2" />
                <circle cx="8" cy="12" r="1.2" />
                <circle cx="12" cy="12" r="1.2" />
                <circle cx="16" cy="12" r="1.2" />
                <circle cx="8" cy="16" r="1.2" />
                <circle cx="12" cy="16" r="1.2" />
                <circle cx="16" cy="16" r="1.2" />
              </BioIcon>
            </div>

            <button
              className="btn btn-primary w-full py-3"
              onClick={passkeyLogin}
              disabled={!hasPasskey || passkeyBusy}
            >
              {passkeyBusy ? '確認中…' : 'パスキーでログイン'}
            </button>

            <p className="mt-3 text-xs text-ink3">
              {hasPasskey
                ? 'はじめての場合は、パスワードでログインしたあと、アカウント画面でパスキーを登録してください。'
                : 'この端末ではパスキーを利用できません。パスワードでログインしてください。'}
            </p>
          </section>

          {/* 区切り */}
          <div className="flex items-center justify-center">
            <span className="hidden h-full w-px bg-line md:block" />
            <span className="flex items-center gap-3 text-xs text-ink3 md:hidden">
              <span className="h-px w-16 bg-line" />
              または
              <span className="h-px w-16 bg-line" />
            </span>
            <span className="absolute hidden bg-page px-2 text-xs text-ink3 md:block">または</span>
          </div>

          {/* 右：パスワード */}
          <section className="card p-6">
            <h2 className="text-base font-bold">
              {mode === 'signin' ? 'パスワードでログイン' : 'アカウントを作成'}
            </h2>
            <form className="mt-4 flex flex-col gap-3" onSubmit={submit}>
              <label className="flex flex-col gap-1">
                <span className="label">メールアドレス</span>
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="label">パスワード</span>
                <input
                  className="input"
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6文字以上"
                />
              </label>

              <button className="btn btn-quiet mt-1 w-full py-3" disabled={busy} type="submit">
                {busy ? '処理中…' : mode === 'signin' ? 'ログイン' : '登録する'}
              </button>
            </form>

            <button
              type="button"
              className="btn btn-ghost mt-2 w-full text-sm"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setErr(null)
                setInfo(null)
              }}
            >
              {mode === 'signin' ? 'アカウントをお持ちでない方' : 'すでに登録済みの方'}
            </button>
          </section>
        </div>

        {(err || info) && (
          <div className="mt-5">
            {err && (
              <p className="flex gap-2 rounded-xl border border-down/25 bg-down-soft px-4 py-3 text-sm text-down">
                <Icon name="info" size={17} className="mt-0.5 shrink-0" />
                <span className="whitespace-pre-wrap">{err}</span>
              </p>
            )}
            {info && (
              <p className="flex gap-2 rounded-xl border border-up/25 bg-up-soft px-4 py-3 text-sm text-up">
                <Icon name="check" size={17} className="mt-0.5 shrink-0" />
                {info}
              </p>
            )}
          </div>
        )}

        {onSkip && (
          <button className="btn btn-ghost mx-auto mt-8 text-sm" onClick={onSkip}>
            ログインせずにサンプルを見る
          </button>
        )}
      </main>

      <footer className="border-t border-line px-5 py-4">
        <p className="mx-auto max-w-4xl text-xs text-ink3">
          取引データはアカウントごとに分かれて保存され、他の人からは見えません。
        </p>
      </footer>
    </div>
  )
}

function BioIcon({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex flex-col items-center gap-1.5 text-ink3">
      <svg
        width="34"
        height="34"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
      <span className="text-[10px] font-semibold">{label}</span>
    </span>
  )
}

/** Supabaseの英語エラーを日本語にする */
function translateAuthError(e: unknown): string {
  const raw = friendlyError(e)
  if (/Invalid login credentials/i.test(raw)) return 'メールアドレスかパスワードが違います'
  if (/User already registered/i.test(raw))
    return 'このメールアドレスは登録済みです。ログインをお試しください'
  if (/Email not confirmed/i.test(raw))
    return 'メールの確認が済んでいません。届いたメールのリンクを開いてください'
  if (/Password should be at least/i.test(raw)) return 'パスワードが短すぎます'
  if (/rate limit|too many/i.test(raw))
    return '試行回数が多すぎます。しばらく待ってからお試しください'
  return raw
}
