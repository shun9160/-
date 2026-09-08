// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import WeekStrip from '../WeekStrip'
import { dayIn } from '../MonthPicker'

/**
 * 見出しを押して、年と月を選ぶところ。
 *
 * 指で流して何ヶ月も戻るのは骨が折れるので、ここから飛べるようにしてある。
 * まだ来ていない月へ行かせないことと、
 * 飛んだ先が「見るもののある日」になっていることを見る。
 */

beforeAll(() => {
  Element.prototype.scrollTo = vi.fn()
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    disconnect() {}
  }
})

afterEach(cleanup)

const ACTIVE = new Set(['2026-07-03', '2026-07-28', '2026-09-01', '2026-09-07'])

function open(value = '2026-09-08', onChange = () => {}) {
  const r = render(
    <WeekStrip value={value} onChange={onChange} activeDays={ACTIVE} max="2026-09-08" />,
  )
  fireEvent.click(r.container.querySelector('button[aria-haspopup="dialog"]')!)
  return r
}

/** 「7月」などの月のボタン。10月〜12月と1月を取り違えないよう、頭から見る */
const monthButton = (label: string) =>
  [...screen.getByRole('dialog').querySelectorAll('button')].find(
    (b) => b.textContent?.startsWith(label),
  )!

describe('年と月を選ぶ', () => {
  it('見出しを押すと開く', () => {
    open()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('2026年')).toBeTruthy()
  })

  it('まだ来ていない月は押せない', () => {
    // 今日が9月8日なら、10月以降はまだ記録できない
    open()
    expect(monthButton('9月').disabled).toBe(false)
    expect(monthButton('10月').disabled).toBe(true)
    expect(monthButton('12月').disabled).toBe(true)
  })

  it('取引のあった月には点が付く', () => {
    open()
    // 7月と9月にだけ取引がある
    const dot = (label: string) => monthButton(label).querySelector('span')!.className
    expect(dot('7月')).toContain('bg-')
    expect(dot('7月')).not.toContain('bg-transparent')
    expect(dot('8月')).toContain('bg-transparent')
  })

  it('選ぶと、その月の最後の取引日へ飛ぶ', () => {
    // 月を選ぶ人は「その月に何があったか」を見にきている
    const onChange = vi.fn()
    open('2026-09-08', onChange)
    fireEvent.click(monthButton('7月'))
    expect(onChange).toHaveBeenCalledWith('2026-07-28')
  })

  it('選んだあとは閉じる', () => {
    open()
    fireEvent.click(monthButton('7月'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('「閉じる」で、何も変えずに閉じる', () => {
    const onChange = vi.fn()
    open('2026-09-08', onChange)
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('今日より先の年へは進めない', () => {
    open()
    expect(screen.getByRole('button', { name: '次の年' })).toHaveProperty('disabled', true)
  })
})

describe('飛んだ先の日', () => {
  it('取引のある月は、その月の最後の取引日', () => {
    expect(dayIn(2026, 7, '2026-09-08', '2026-09-08', ACTIVE)).toBe('2026-07-28')
  })

  it('取引の無い月は、いま選んでいる日と同じ日にち', () => {
    expect(dayIn(2026, 8, '2026-09-08', '2026-09-08', ACTIVE)).toBe('2026-08-08')
  })

  it('その月に無い日にちなら、末日に寄せる', () => {
    // 31日を選んでいるときの2月
    expect(dayIn(2026, 2, '2026-08-31', '2026-09-08', new Set())).toBe('2026-02-28')
    expect(dayIn(2024, 2, '2024-08-31', '2026-09-08', new Set())).toBe('2024-02-29')
  })

  it('今日より先には行かない', () => {
    // 今日が9月8日で、20日を選んでいるときに今月を押した
    expect(dayIn(2026, 9, '2026-08-20', '2026-09-08', new Set())).toBe('2026-09-08')
  })

  it('今日より先の取引日は選ばない', () => {
    // 先の日付が混ざっていても、今日を追い越さない
    const future = new Set(['2026-09-01', '2026-09-30'])
    expect(dayIn(2026, 9, '2026-09-08', '2026-09-08', future)).toBe('2026-09-01')
  })
})
