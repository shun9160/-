// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import WeekStrip from '../WeekStrip'

/**
 * 上に置く日付の並び。
 *
 * ここで一度やらかしているのが「年月の見出しが左端に見えている日に付いていく」形で、
 * 9月4日を選んでいるのに見出しが「8月」になり、すぐ下のカードと食い違って読めた。
 * 見出しは必ず「選んでいる日」に付ける。
 */

beforeAll(() => {
  // jsdom には無い2つ。どちらも見た目を整えるためだけのもので、
  // 中身の正しさには関わらないので、空で置き換える
  Element.prototype.scrollTo = vi.fn()
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    disconnect() {}
  }
})

afterEach(cleanup)

const base = {
  activeDays: new Set(['2026-09-03']),
  max: '2026-09-04',
  onChange: () => {},
}

/**
 * 左に出ている見出しだけを読む。
 * 画面全体の文字を見ると、日の「8」と隣の曜日の「月」がつながって
 * 「8月」に読めてしまい、見出しを見ていることにならない
 */
const heading = (c: HTMLElement) =>
  [...c.querySelectorAll('p')].map((p) => p.textContent).join(' ')

describe('WeekStrip', () => {
  it('年月は、選んでいる日のものを出す', () => {
    const { container } = render(<WeekStrip {...base} value="2026-09-04" />)
    expect(heading(container)).toBe('2026 9月')
  })

  it('月をまたいで選び直すと、見出しも付いていく', () => {
    const { container, rerender } = render(<WeekStrip {...base} value="2026-09-04" />)
    rerender(<WeekStrip {...base} value="2026-08-20" />)
    expect(heading(container)).toBe('2026 8月')
  })

  it('選んでいる日が押されている印を持つのは1つだけ', () => {
    const { container } = render(<WeekStrip {...base} value="2026-09-01" />)
    const on = [...container.querySelectorAll('button[aria-pressed="true"]')]
    expect(on).toHaveLength(1)
    expect(on[0].textContent).toContain('1')
  })

  it('今日より先へは送れない', () => {
    const { container } = render(<WeekStrip {...base} value="2026-09-04" />)
    const next = container.querySelector('button[aria-label="次の週"]') as HTMLButtonElement
    expect(next.disabled).toBe(true)
  })

  it('紫の面に載せたときは、色を白系に入れ替える', () => {
    const { container } = render(<WeekStrip {...base} value="2026-09-04" onDark />)
    const on = container.querySelector('button[aria-pressed="true"]')!
    expect(on.className).toContain('bg-white')
    // 土日の青と赤は紫に沈むので、濃い面では使わない
    expect(container.innerHTML).not.toContain('text-[#4A6BFF]')
  })
})
