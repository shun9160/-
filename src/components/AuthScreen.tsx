import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import Icon from './Icon'

type Mode = 'signin' | 'signup'

interface Props {
  /** Supabase未設定のとき、サンプルを見るために素通りする */
  onSkip?: () => void
}

export default function AuthScreen({ onSkip }: Props) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

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
        // メール確認が有効な場合はセッションが返らない
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

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white">
            <Icon name="chart" size={24} />
          </span>
          <h1 className="mt-3 text-xl font-bold tracking-tight">FX Trading Journal</h1>
          <p className="mt-0.5 text-sm text-ink2">
            {mode === 'signin' ? 'ログインして続けます' : 'アカウントを作成します'}
          </p>
        </div>

        <form className="card flex flex-col gap-3 p-5" onSubmit={submit}>
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

          {err && (
            <p className="whitespace-pre-wrap rounded-xl border border-down/25 bg-down-soft px-3 py-2 text-sm text-down">
              {err}
            </p>
          )}
          {info && (
            <p className="rounded-xl border border-up/25 bg-up-soft px-3 py-2 text-sm text-up">
              {info}
            </p>
          )}

          <button className="btn btn-primary mt-1 w-full" disabled={busy} type="submit">
            {busy ? '処理中…' : mode === 'signin' ? 'ログイン' : '登録する'}
          </button>

          <button
            type="button"
            className="btn btn-ghost w-full"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setErr(null)
              setInfo(null)
            }}
          >
            {mode === 'signin'
              ? 'アカウントをお持ちでない方はこちら'
              : 'すでに登録済みの方はこちら'}
          </button>
        </form>

        {onSkip && (
          <button className="btn btn-ghost mt-3 w-full text-sm" onClick={onSkip}>
            ログインせずにサンプルを見る
          </button>
        )}

        <p className="mt-5 text-center text-xs text-ink3">
          取引データはあなたのアカウントにのみ保存され、他の人からは見えません
        </p>
      </div>
    </div>
  )
}

/** Supabaseの英語エラーを日本語にする */
function translateAuthError(e: unknown): string {
  const raw = friendlyError(e)
  if (/Invalid login credentials/i.test(raw))
    return 'メールアドレスかパスワードが違います'
  if (/User already registered/i.test(raw))
    return 'このメールアドレスは登録済みです。ログインをお試しください'
  if (/Email not confirmed/i.test(raw))
    return 'メールの確認が済んでいません。届いたメールのリンクを開いてください'
  if (/Password should be at least/i.test(raw)) return 'パスワードが短すぎます'
  if (/rate limit|too many/i.test(raw))
    return '試行回数が多すぎます。しばらく待ってからお試しください'
  return raw
}
