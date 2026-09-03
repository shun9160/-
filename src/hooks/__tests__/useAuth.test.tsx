// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * ログインの確認。
 *
 * ここが返ってこないと「読み込み中…」から一生動かない画面になる。
 * 利用者にできることが何も無く、アプリが壊れたようにしか見えないので、
 * 「必ず終わる」ことをここで縛っておく。
 */

/** getSession の返事を、テストから好きなタイミングで決められるようにする */
let getSession: () => Promise<{ data: { session: unknown } }>
let onChange: ((event: string, session: unknown) => void) | null = null
const unsubscribe = vi.fn()

vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return {
      auth: {
        getSession: () => getSession(),
        onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
          onChange = cb
          return { data: { subscription: { unsubscribe } } }
        },
        signOut: async () => {},
      },
    }
  },
  isSupabaseConfigured: true,
}))

const { useAuth } = await import('../useAuth')

function Harness({ onState }: { onState: (s: string) => void }) {
  const { ready, stalled, session } = useAuth()
  onState(`${ready ? 'ready' : 'waiting'}/${stalled ? 'stalled' : 'ok'}/${session ? 'in' : 'out'}`)
  return null
}

let states: string[]

beforeEach(() => {
  vi.useFakeTimers()
  states = []
  onChange = null
  getSession = async () => ({ data: { session: null } })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const last = () => states[states.length - 1]

describe('ログインの確認', () => {
  it('ふつうに返ってくれば、そのまま進む', async () => {
    getSession = async () => ({ data: { session: { user: { email: 'a@example.com' } } } })
    render(<Harness onState={(s) => states.push(s)} />)
    await act(async () => {})
    expect(last()).toBe('ready/ok/in')
  })

  it('返事が返ってこなくても、5秒で先へ進む', async () => {
    // これが今回の詰まり方。getSession は中で
    // 「保存してあるトークンの更新」を待つが、そこに時間の上限が無い
    getSession = () => new Promise(() => {})
    render(<Harness onState={(s) => states.push(s)} />)
    await act(async () => {})
    expect(last()).toBe('waiting/ok/out')

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(last()).toBe('ready/stalled/out')
  })

  it('失敗したときも、先へ進む', async () => {
    // catch が無いと、例外が宙に浮いて ready が立たないまま終わる
    getSession = async () => {
      throw new Error('ネットワークに届きません')
    }
    render(<Harness onState={(s) => states.push(s)} />)
    await act(async () => {})
    expect(last()).toBe('ready/stalled/out')
  })

  it('先へ進んだあとで確認が終わったら、何もしなくても元に戻る', async () => {
    getSession = () => new Promise(() => {})
    render(<Harness onState={(s) => states.push(s)} />)
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(last()).toBe('ready/stalled/out')

    // 遅れて本当のログイン状態が届く
    await act(async () => {
      onChange?.('INITIAL_SESSION', { user: { email: 'a@example.com' } })
    })
    expect(last()).toBe('ready/ok/in')
  })

  it('時間内に返ってきたら、あとから時計が進んでも巻き戻らない', async () => {
    getSession = async () => ({ data: { session: { user: { email: 'a@example.com' } } } })
    render(<Harness onState={(s) => states.push(s)} />)
    await act(async () => {})
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })
    // 上限の時計が遅れて動いても、ログイン済みを消してはいけない
    expect(last()).toBe('ready/ok/in')
  })

  it('画面を離れるときは、見張りを外す', async () => {
    const { unmount } = render(<Harness onState={(s) => states.push(s)} />)
    await act(async () => {})
    unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })
})
