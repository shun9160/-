import { useEffect, useRef, useState } from 'react'
import { checkForUpdate } from '../lib/appVersion'

/**
 * 新しい版が出ていないか、ときどき見にいく。
 *
 * いつ見るか:
 *  - 開いた少しあと（1回だけ）
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

/**
 * 開いてから、最初に見にいくまで(ms)。
 *
 * 立ち上がりの読み込みと重ならないよう、少しだけ待つ。
 */
const FIRST_LOOK = 5000

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

    /*
      開いた少しあとに、一度だけ見にいく。

      以前は「いま読み込んだばかりなので必ず最新」として、ここを飛ばしていた。
      それはブラウザで開いたときの話で、ホーム画面に置いたアプリには当てはまらない。
      iOS は控えから起こすことがあり、古い版のまま立ち上がる。
      その結果「Safari では新しいのに、ホーム画面のアプリだけ古い」が起きて、
      同じアプリなのに見た目が違う、ということになる。

      読みにいくのは index.html 1つぶんだけなので、立ち上がりの邪魔にはならない。
    */
    const first = window.setTimeout(() => void look(), FIRST_LOOK)

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
      window.clearTimeout(first)
    }
  }, [found])

  return found
}
