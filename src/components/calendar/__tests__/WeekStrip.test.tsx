// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
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
const headingButton = (c: HTMLElement) =>
  c.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement
const heading = (c: HTMLElement) =>
  [...headingButton(c).querySelectorAll('span')].map((s) => s.textContent).join(' ')

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

/**
 * 指で流したときの見出し。
 *
 * jsdom には見た目の大きさが無いので、
 * 「どこまで流したか」と「どれだけ見えているか」を自分で置いてから流す。
 *
 * 並びは 2026-09-08 で終わる180日ぶん（days[179] が 9/8）。
 * 1目盛り48px、見えている幅261px なら5日ぶん見える。
 */
const STEP = 48
const WIDTH = 261

function scrollTo(container: HTMLElement, firstIndex: number) {
  const strip = container.querySelector('.overflow-x-auto') as HTMLElement
  Object.defineProperty(strip, 'clientWidth', { value: WIDTH, configurable: true })
  Object.defineProperty(strip, 'scrollLeft', { value: firstIndex * STEP, configurable: true })
  fireEvent.scroll(strip)
}

describe('流したときの見出し', () => {
  const props = { ...base, max: '2026-09-08', value: '2026-09-04' }
  // days[179] = 9/8 なので、9/1 は 172、8/20 は 160、9/4 は 175
  const SEP_1 = 172
  const AUG_20 = 160

  it('選んでいる日が見えている間は、その日の月を出す', () => {
    const { container } = render(<WeekStrip {...props} />)
    scrollTo(container, SEP_1 + 1) // 9/2〜9/6 が見える。9/4 は中にある
    expect(heading(container)).toBe('2026 9月')
  })

  it('選んでいる日が流れて見えなくなったら、見えている月に変わる', () => {
    const { container } = render(<WeekStrip {...props} />)
    scrollTo(container, AUG_20) // 8/20〜8/24。9/4 は見えていない
    expect(heading(container)).toBe('2026 8月')
  })

  it('戻せば、また選んでいる日の月に戻る', () => {
    const { container } = render(<WeekStrip {...props} />)
    scrollTo(container, AUG_20)
    expect(heading(container)).toBe('2026 8月')
    scrollTo(container, SEP_1 + 1)
    expect(heading(container)).toBe('2026 9月')
  })

  it('先月の日のほうが多く見えていても、選んでいる日があるほうを出す', () => {
    /*
      ここが以前こわれていたところ。
      8/29 8/30 8/31 9/1 9/2 のように、見えている日は8月のほうが多い。
      数だけで決めると、9月1日を選んでいるのに見出しが8月になり、
      すぐ下のカードと食い違って読めた。
      選んでいる日が見えているなら、そちらを優先する
    */
    const { container } = render(<WeekStrip {...props} value="2026-09-01" />)
    scrollTo(container, SEP_1 - 3) // 8/29〜9/2。8月3日ぶん・9月2日ぶん
    expect(heading(container)).toBe('2026 9月')
  })

  it('大きさが分からないうちは、選んでいる日の月を出す', () => {
    // 幅が0のまま「見えている日」を数えると、並びの先頭に引っぱられる
    const { container } = render(<WeekStrip {...props} />)
    const strip = container.querySelector('.overflow-x-auto') as HTMLElement
    Object.defineProperty(strip, 'clientWidth', { value: 0, configurable: true })
    fireEvent.scroll(strip)
    expect(heading(container)).toBe('2026 9月')
  })
})
