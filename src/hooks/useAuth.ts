import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  session: Session | null
  /** 認証状態の確認が終わったか */
  ready: boolean
  userEmail: string | null
  signOut: () => Promise<void>
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setReady(true)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setReady(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase?.auth.signOut()
    setSession(null)
  }

  return {
    session,
    ready,
    userEmail: session?.user.email ?? null,
    signOut,
  }
}
