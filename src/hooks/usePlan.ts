import { useCallback, useEffect, useState } from 'react'
import type { PlanState } from '../lib/plan'
import { FREE_STATE } from '../lib/plan'
import { fetchPlanState } from '../lib/repo'

/**
 * いまのプラン。
 *
 * ここで持つのは「画面に出すため」の値。これで機能を止めてはいない。
 * 本当の壁はデータベース側（RLS）にあり、無料プランなら
 * 31日より前の行はそもそも降りてこない。
 *
 * だから、この値が読めなかったとき無料として扱っても、
 * 有料の人が使えなくなることはない。料金ページの表示が
 * 一瞬ずれるだけで済む。逆に「読めないから有料にしておく」は、
 * 払っていない人に有料の顔を見せることになるので選ばない。
 */
export function usePlan(authed: boolean): {
  plan: PlanState
  loading: boolean
  reload: () => Promise<void>
} {
  const [plan, setPlan] = useState<PlanState>(FREE_STATE)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!authed) {
      setPlan(FREE_STATE)
      setLoading(false)
      return
    }
    setLoading(true)
    setPlan(await fetchPlanState())
    setLoading(false)
  }, [authed])

  useEffect(() => {
    void reload()
  }, [reload])

  /*
    支払いから戻ってきた直後は、Stripe の通知がまだ届いていないことがある。
    「払ったのに無料のまま」に見えるので、少しあけてもう一度読む。
    ?paid=1 は支払い後の戻り先に付けている印。
  */
  useEffect(() => {
    if (!authed) return
    if (!new URLSearchParams(window.location.search).has('paid')) return
    const timers = [2000, 6000].map((ms) => window.setTimeout(() => void reload(), ms))
    return () => timers.forEach(window.clearTimeout)
  }, [authed, reload])

  return { plan, loading, reload }
}
