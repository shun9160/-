// @vitest-environment jsdom
import { useState } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutoSave } from '../useAutoSave'

/**
 * 自動保存のテスト。
 *
 * 「保存する」ボタンを置かない代わりに、ここが確実に動いている必要がある。
 * 手が止まってから送る／二度同じものを送らない／画面を離れるときに送る、
 * の3つが崩れると、書いたものが黙って消える。
 */

/** 中身を1つ持ち、外から書き換えられる小さな画面 */
function Harness({
  save,
  skip,
  paused,
  onState,
}: {
  save: (v: { text: string }) => Promise<void>
  skip?: (v: { text: string }) => boolean
  paused?: boolean
  onState?: (s: string) => void
}) {
  const [value, setValue] = useState({ text: '' })
  const { state, error } = useAutoSave(value, save, { delay: 900, paused, skip })
  onState?.(state)
  return (
    <button data-testid="type" onClick={() => setValue((v) => ({ text: v.text + 'あ' }))}>
      {state}
      {error && <span data-testid="err">{error}</span>}
    </button>
  )
}

let saved: string[]
let save: (v: { text: string }) => Promise<void>

beforeEach(() => {
  vi.useFakeTimers()
  saved = []
  save = vi.fn(async (v: { text: string }) => {
    saved.push(v.text)
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** 打つ */
function type(el: HTMLElement, times = 1) {
  for (let i = 0; i < times; i++) act(() => el.click())
}

/** 待つ */
function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('useAutoSave', () => {
  it('手が止まってから送る。打っている間は送らない', () => {
    const { getByTestId } = render(<Harness save={save} />)
    const el = getByTestId('type')

    type(el, 3)
    wait(500)
    expect(saved).toEqual([])

    wait(500)
    expect(saved).toEqual(['あああ'])
  })

  it('打つたびに送らない。まとめて1回だけ', () => {
    const { getByTestId } = render(<Harness save={save} />)
    const el = getByTestId('type')

    for (let i = 0; i < 10; i++) {
      type(el)
      wait(100)
    }
    wait(900)
    expect(save).toHaveBeenCalledTimes(1)
    expect(saved).toEqual(['ああああああああああ'])
  })

  it('開いただけでは送らない。最初の中身は「保存済み」として控える', () => {
    render(<Harness save={save} />)
    wait(2000)
    expect(save).not.toHaveBeenCalled()
  })

  it('同じ中身なら二度送らない', () => {
    const { getByTestId } = render(<Harness save={save} />)
    const el = getByTestId('type')

    type(el)
    wait(1000)
    expect(save).toHaveBeenCalledTimes(1)

    // 中身が変わっていないので、再描画されても送らない
    wait(5000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('保存中は「保存中…」、終わったら「保存しました」', async () => {
    const states: string[] = []
    const { getByTestId } = render(<Harness save={save} onState={(s) => states.push(s)} />)
    type(getByTestId('type'))
    wait(1000)
    await act(async () => {})
    expect(states).toContain('saving')
    expect(states).toContain('saved')
  })

  it('送るのを止めているあいだは送らない', () => {
    const { getByTestId } = render(<Harness save={save} paused />)
    type(getByTestId('type'), 2)
    wait(3000)
    expect(save).not.toHaveBeenCalled()
  })

  it('送らなくてよい中身（まっさら）は送らない', () => {
    const { getByTestId } = render(<Harness save={save} skip={() => true} />)
    type(getByTestId('type'))
    wait(3000)
    expect(save).not.toHaveBeenCalled()
  })

  it('画面を離れるときは、待たずに送る', () => {
    const { getByTestId, unmount } = render(<Harness save={save} />)
    type(getByTestId('type'))
    // まだ待ち時間の途中
    wait(200)
    expect(save).not.toHaveBeenCalled()

    unmount()
    expect(saved).toEqual(['あ'])
  })

  it('失敗したら状態が error になり、理由も出る', async () => {
    const bad = vi.fn(async () => {
      throw new Error('だめでした')
    })
    const states: string[] = []
    const { getByTestId } = render(<Harness save={bad} onState={(s) => states.push(s)} />)
    type(getByTestId('type'))
    wait(1000)
    await act(async () => {})
    expect(states).toContain('error')
    // 「保存できませんでした」だけでは直しようがないので、理由も持って帰る
    expect(getByTestId('err').textContent).toContain('だめでした')
  })

  it('失敗したあと書き直して成功したら、理由は消える', async () => {
    let ok = false
    const flaky = vi.fn(async (v: { text: string }) => {
      if (!ok) throw new Error('いちどめは失敗')
      saved.push(v.text)
    })
    const { getByTestId, queryByTestId } = render(<Harness save={flaky} />)
    type(getByTestId('type'))
    wait(1000)
    await act(async () => {})
    expect(queryByTestId('err')).not.toBeNull()

    ok = true
    type(getByTestId('type'))
    wait(1000)
    await act(async () => {})
    expect(queryByTestId('err')).toBeNull()
  })

  it('送っている最中に書かれたら、終わってからもう一度送る', async () => {
    let release!: () => void
    const slow = vi.fn(
      (v: { text: string }) =>
        new Promise<void>((res) => {
          saved.push(v.text)
          release = res
        }),
    )
    const { getByTestId } = render(<Harness save={slow} />)
    const el = getByTestId('type')

    type(el)
    wait(1000)
    expect(saved).toEqual(['あ'])

    // 送信中にもう1文字
    type(el)
    wait(1000)
    expect(slow).toHaveBeenCalledTimes(1)

    await act(async () => {
      release()
    })
    expect(saved).toEqual(['あ', 'ああ'])
  })
})
