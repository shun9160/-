// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enrichTrade } from '../../../lib/analytics'
import type { Trade } from '../../../lib/types'

/**
 * その日の取引を並べるところ。
 *
 * 指で左へ払うと「削除」が出る。消すのは取り返しがつかないので、
 * 押しただけでは消さない・訊いてから消す・失敗したら黙らない、の3つを見る。
 */

const deleteTrade = vi.fn(async () => {})

vi.mock('../../../lib/repo', () => ({
  deleteTrade: (...a: unknown[]) => deleteTrade(...(a as [])),
  updateTrade: async () => {},
}))

const TradeEmbed = (await import('../TradeEmbed')).default

const trade = (over: Partial<Trade> = {}) =>
  enrichTrade({
    id: 't1',
    ticket: '111',
    symbol: 'XAUUSD.raw',
    side: 'sell',
    volume: 0.05,
    open_price: 4403.45,
    close_price: 4403.34,
    sl: null,
    tp: null,
    open_time: '2026-09-07T03:01:00.000Z',
    close_time: '2026-09-07T03:20:00.000Z',
    commission: 0,
    swap: 0,
    profit: 86,
    currency: 'JPY',
    note: null,
    source: 'screenshot',
    ...over,
  })

/** 指で払って出てくる赤いボタン */
const swipeButton = () => document.querySelector<HTMLButtonElement>('.no-bar button[aria-hidden="true"]')

/** 行を閉じ直す動き。jsdom には無いので置き換える */
const scrollTo = vi.fn()

beforeEach(() => {
  deleteTrade.mockResolvedValue(undefined)
  scrollTo.mockClear()
  Element.prototype.scrollTo = scrollTo
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('取引を消す', () => {
  it('訊いて、はいなら消して、画面を作り直す', async () => {
    const onChanged = vi.fn()
    render(<TradeEmbed trades={[trade()]} onChanged={onChanged} />)

    fireEvent.click(swipeButton()!)

    await waitFor(() => expect(deleteTrade).toHaveBeenCalledWith('t1'))
    expect(onChanged).toHaveBeenCalled()
  })

  it('どれを消すのかを、訊く文の中に入れる', () => {
    // 払って出したボタンは、隣の行のものかもしれない
    render(<TradeEmbed trades={[trade()]} onChanged={() => {}} />)
    fireEvent.click(swipeButton()!)

    const asked = vi.mocked(window.confirm).mock.calls[0][0] as string
    expect(asked).toContain('XAUUSD.raw')
    expect(asked).toContain('SELL')
    // 一緒に消えるものも言っておく
    expect(asked).toContain('チャート')
  })

  it('押したら、赤いところは閉じ直す', () => {
    // 消さなかったときに赤いままだと、消えたのかどうかが分からない
    render(<TradeEmbed trades={[trade()]} onChanged={() => {}} />)
    fireEvent.click(swipeButton()!)
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 0 }))
  })

  it('赤が出ている間に行を押したら、開かずにしまう', () => {
    render(<TradeEmbed trades={[trade()]} onChanged={() => {}} />)
    const row = screen.getByRole('button', { expanded: false })

    // 払って赤を出した状態にする
    const box = document.querySelector('.no-bar') as HTMLElement
    Object.defineProperty(box, 'scrollLeft', { value: 84, configurable: true })
    fireEvent.click(row)

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 0 }))
    expect(row.getAttribute('aria-expanded')).toBe('false')
  })

  it('いいえなら、何もしない', () => {
    vi.mocked(window.confirm).mockReturnValue(false)
    const onChanged = vi.fn()
    render(<TradeEmbed trades={[trade()]} onChanged={onChanged} />)

    fireEvent.click(swipeButton()!)

    expect(deleteTrade).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('消せなかったら、そう出す。黙って消えたことにしない', async () => {
    deleteTrade.mockRejectedValue(new Error('つながりません'))
    const onChanged = vi.fn()
    render(<TradeEmbed trades={[trade()]} onChanged={onChanged} />)

    fireEvent.click(swipeButton()!)

    await waitFor(() => expect(screen.getByText(/つながりません/)).toBeTruthy())
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('見るだけの画面では、払っても何も出ない', () => {
    render(<TradeEmbed trades={[trade()]} onChanged={() => {}} readOnly />)
    expect(swipeButton()).toBeNull()
  })

  it('指で払えない画面のために、開いたところにも削除を置く', async () => {
    // パソコンや読み上げでは、払う動きが無い
    render(<TradeEmbed trades={[trade()]} onChanged={() => {}} />)
    fireEvent.click(screen.getByRole('button', { expanded: false }))

    fireEvent.click(await screen.findByRole('button', { name: 'この取引を削除' }))
    await waitFor(() => expect(deleteTrade).toHaveBeenCalledWith('t1'))
  })

  it('赤いボタンは読み上げに出さない。同じことが開いたところでできる', () => {
    render(<TradeEmbed trades={[trade()]} onChanged={() => {}} />)
    // 読み上げに2つ出ると、どちらを押せばいいのか分からなくなる
    expect(swipeButton()!.getAttribute('aria-hidden')).toBe('true')
    expect(swipeButton()!.tabIndex).toBe(-1)
  })
})
