import { useEffect, useRef, useState } from 'react'

/**
 * 書いたそばから勝手に保存する。
 *
 * 「保存する」ボタンを置かないための仕組み。ボタンがあると、
 * 押し忘れて消えるのが怖くて、書くことに集中できなくなる。
 *
 * 打つたびに送ると回数が多すぎるので、手が止まってから送る。
 * 送っている最中にまた書かれたら、終わってからもう一度送る
 * （送信中の内容が古くなったまま終わらないようにする）。
 */

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface Options<T> {
  /** 手が止まってから送るまでの待ち時間(ms) */
  delay?: number
  /** true のあいだは送らない。読み込み中や、見るだけのときに使う */
  paused?: boolean
  /** 送らなくてよい中身か（まっさらな日記など） */
  skip?: (value: T) => boolean
}

export function useAutoSave<T>(
  value: T,
  save: (value: T) => Promise<void>,
  { delay = 900, paused = false, skip }: Options<T> = {},
): SaveState {
  const [state, setState] = useState<SaveState>('idle')

  const saveRef = useRef(save)
  saveRef.current = save
  const skipRef = useRef(skip)
  skipRef.current = skip

  /** 最後に保存できた中身。同じものを二度送らないための控え */
  const savedRef = useRef<string | null>(null)
  /** いま送っている最中か */
  const busy = useRef(false)
  /** 送っている間に来た、もっと新しい中身 */
  const pending = useRef<T | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const clear = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (paused) return
    const json = JSON.stringify(value)

    // 最初に読み込んだ中身は「もう保存済み」として控えるだけ。
    // ここで送ると、開いただけの日に空の行ができてしまう
    if (savedRef.current === null) {
      savedRef.current = json
      return
    }
    if (json === savedRef.current) return
    if (skipRef.current?.(value)) {
      savedRef.current = json
      return
    }

    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void run(value, json), delay)

    return () => window.clearTimeout(timer.current)
    // value の中身が変わったときだけ動かす
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value), paused, delay])

  async function run(v: T, json: string) {
    if (busy.current) {
      pending.current = v
      return
    }
    busy.current = true
    setState('saving')
    window.clearTimeout(clear.current)
    try {
      await saveRef.current(v)
      savedRef.current = json
      setState('saved')
      // しばらくしたら消す。ずっと出ていると視界の邪魔になる
      clear.current = window.setTimeout(() => setState('idle'), 2200)
    } catch {
      setState('error')
    } finally {
      busy.current = false
      const next = pending.current
      pending.current = null
      if (next != null) void run(next, JSON.stringify(next))
    }
  }

  // 画面を離れるときは、待たずに送る。
  // 手が止まるのを待っている途中で閉じられると、書いたものが消えるため
  const latest = useRef(value)
  latest.current = value

  useEffect(() => {
    return () => {
      window.clearTimeout(timer.current)
      window.clearTimeout(clear.current)
      const v = latest.current
      const json = JSON.stringify(v)
      if (json === savedRef.current) return
      if (skipRef.current?.(v)) return
      // 結果はもう画面に出せないので、送るだけ送る
      void saveRef.current(v).catch(() => {})
    }
  }, [])

  return state
}
