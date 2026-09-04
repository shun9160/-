import { useEffect, useRef, useState } from 'react'
import { checkForUpdate } from '../lib/appVersion'

/**
 * 新しい版が出ていないか、ときどき見にいく。
 *
 * いつ見るか:
 *  - 画面に戻ってきたとき（ホーム画面から開き直したとき）
 *  - 開いたまま長く使っているとき（30分ごと）
 *
 * 見つけても、勝手に読み込み直さない。
 * 日記を書いている最中に画面が作り直されると、
 * 打っていた文が飛んだように見える（自動保存はしているが、
 * 目の前で消えれば同じこと）。知らせるだけにして、押すのは本人に任せる。
 */

/** 前に見てから、これだけ空けてまた見る(ms) */
const INTERVAL = 30 * 60 * 1000

export function useAppUpdate(): boolean {
  const [found, setFound] = useState(false)
  const lastCheck = useRef(0)

  useEffect(() => {
    if (!import.meta.env.PROD) return
    let alive = true

    const look = async () => {
      if (!alive || found) return
      const now = Date.now()
      if (now - lastCheck.current < INTERVAL) return
      lastCheck.current = now
      if (await checkForUpdate()) {
        if (alive) setFound(true)
      }
    }

    // 開いた直後は見ない。いま読み込んだばかりなので、必ず最新
    lastCheck.current = Date.now()

    const onVisible = () => {
      if (document.visibilityState === 'visible') void look()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const timer = window.setInterval(() => void look(), INTERVAL)

    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.clearInterval(timer)
    }
  }, [found])

  return found
}
