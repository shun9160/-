import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  session: Session | null
  /** 認証状態の確認が終わったか */
  ready: boolean
  /**
   * 確認が時間内に終わらなかったか。
   * 未ログインとして先へ進めているが、本当は分からない状態
   */
  stalled: boolean
  userEmail: string | null
  signOut: () => Promise<void>
}

/**
 * ログインの確認を、いつまでも待たない上限(ms)。
 *
 * supabase の getSession() は、中で「保存してあるトークンの更新」を待つ。
 * ここには時間の上限が無い。電波が細いときや、保存されている
 * トークンが古すぎるときに、返事が返ってこないことがある。
 *
 * 待ち続けると「読み込み中…」から一生動かない画面になる。
 * 利用者にできることが何も無く、アプリが壊れたようにしか見えない。
 * それなら、いったん未ログインとして先へ進めたほうがいい。
 * あとから確認が終われば onAuthStateChange が拾ってくれる。
 */
const READY_TIMEOUT = 5000

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [stalled, setStalled] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setReady(true)
      return
    }

    let done = false
    const finish = (s: Session | null, timedOut = false) => {
      if (done) return
      done = true
      setSession(s)
      setStalled(timedOut)
      setReady(true)
    }

    // 上限。ここを過ぎたら、確認できないまま先へ進める
    const timer = window.setTimeout(() => finish(null, true), READY_TIMEOUT)

    supabase.auth
      .getSession()
      .then(({ data }) => finish(data.session))
      // 失敗しても画面は出す。ここで握りつぶさないと、
      // 例外がそのまま宙に浮いて ready が立たない
      .catch(() => finish(null, true))

    /*
      確認が遅れて終わったときのため、こちらは切らずに残しておく。
      上で「未ログイン」として進めていても、あとから本当のログイン状態が
      届けばここで拾える。利用者は何もしなくても元に戻る。
    */
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      window.clearTimeout(timer)
      done = true
      setSession(s)
      setStalled(false)
      setReady(true)
    })

    return () => {
      window.clearTimeout(timer)
      sub.subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await supabase?.auth.signOut()
    setSession(null)
  }

  return {
    session,
    ready,
    stalled,
    userEmail: session?.user.email ?? null,
    signOut,
  }
}
