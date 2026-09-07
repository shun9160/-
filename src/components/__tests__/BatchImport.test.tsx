// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tradeKey } from '../../lib/tradeDedup'
import { parseMt5DateTime } from '../../lib/timezone'

/**
 * スクショからの取り込みで、同じ取引が二重に入らないこと。
 *
 * 取引番号があるものは、記録するときに番号で上書きされるので増えない。
 * 番号が読み取れなかったものだけが、黙って2件になりうる。
 * ここではその「印を付けて、初めから外しておく」ところを見る。
 */

const readTradesFromImages = vi.fn()
const findSavedTradeKeys = vi.fn(async () => new Set<string>())
const insertTrades = vi.fn(async () => [])

vi.mock('../../lib/ocr', () => ({ readTradesFromImages: (...a: unknown[]) => readTradesFromImages(...a) }))
vi.mock('../../lib/image', () => ({
  fileToDownscaledDataUrl: async () => 'data:image/jpeg;base64,x',
}))
vi.mock('../../lib/imageHash', () => ({
  hashFile: async (f: File) => `hash-${f.name}`,
}))
vi.mock('../../lib/repo', () => ({
  findSavedScreenshotHashes: async () => new Set<string>(),
  findSavedTradeKeys: (...a: unknown[]) => findSavedTradeKeys(...(a as [])),
  findSavedImageHashes: async () => new Set<string>(),
  addTradeImages: async () => [],
  insertTrades: (...a: unknown[]) => insertTrades(...(a as [])),
}))

const BatchImport = (await import('../BatchImport')).default

/** MT5 の一覧から読めた1件ぶん */
const trade = (over: Record<string, unknown> = {}) => ({
  symbol: 'USDJPY',
  side: 'buy',
  volume: 0.02,
  openTime: '2026.09.04 15:30:12',
  closeTime: '2026.09.04 16:02:41',
  openPrice: 147.21,
  closePrice: 147.44,
  profit: 460,
  ticket: null,
  ...over,
})

/** 画像を選んだことにする */
async function pick(name = 'shot.png') {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File(['x'], name, { type: 'image/png' })
  fireEvent.change(input, { target: { files: [file] } })
  await waitFor(() => expect(screen.getByText(/読み取り結果/)).toBeTruthy())
}

const marks = () => screen.queryAllByText('前に入れたものと同じかも')
const boxes = () =>
  [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].map((b) => b.checked)

beforeEach(() => {
  findSavedTradeKeys.mockResolvedValue(new Set<string>())
  insertTrades.mockResolvedValue([])
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('スクショ取り込みの二重登録', () => {
  it('1枚の中に同じ取引が2件あれば、2件目に印を付けて外す', async () => {
    readTradesFromImages.mockResolvedValue([
      { file: new File(['x'], 'shot.png'), trades: [trade(), trade()] },
    ])
    render(<BatchImport onSaved={() => {}} accountId="acc-1" />)
    await pick()

    expect(marks()).toHaveLength(1)
    // 1件目は入れる、2件目は外す
    expect(boxes()).toEqual([true, false])
    expect(screen.getByText(/すでに入っている取引と同じかもしれません/)).toBeTruthy()
  })

  it('すでに入っている取引と同じなら、印を付けて外す', async () => {
    // MT5 の時刻はブローカーの時計なので、日本時間への直し方は
    // アプリの決まりに任せる。ここで時差を書くと、決まりを変えたときに嘘になる
    findSavedTradeKeys.mockResolvedValue(
      new Set([
        tradeKey({
          symbol: 'USDJPY',
          side: 'buy',
          openTime: parseMt5DateTime('2026.09.04 15:30:12'),
          volume: 0.02,
        })!,
      ]),
    )
    readTradesFromImages.mockResolvedValue([
      { file: new File(['x'], 'shot.png'), trades: [trade()] },
    ])
    render(<BatchImport onSaved={() => {}} accountId="acc-1" />)
    await pick()

    expect(marks()).toHaveLength(1)
    expect(boxes()).toEqual([false])
  })

  it('取引番号があるものは、印を付けない', async () => {
    // 番号があるものは記録するときに上書きされるので、二重にならない。
    // ここで外してしまうと、直した内容を入れ直せなくなる
    readTradesFromImages.mockResolvedValue([
      {
        file: new File(['x'], 'shot.png'),
        trades: [trade({ ticket: '12345' }), trade({ ticket: '12345' })],
      },
    ])
    render(<BatchImport onSaved={() => {}} accountId="acc-1" />)
    await pick()

    expect(marks()).toHaveLength(0)
    expect(boxes()).toEqual([true, true])
  })

  it('時刻が読み取れていないものは、印を付けない', async () => {
    // 読み取れなかったもの同士を「同じ」と言うと、
    // これから直して入れるはずの取引が消える
    readTradesFromImages.mockResolvedValue([
      {
        file: new File(['x'], 'shot.png'),
        trades: [trade({ openTime: null }), trade({ openTime: null })],
      },
    ])
    render(<BatchImport onSaved={() => {}} accountId="acc-1" />)
    await pick()

    expect(marks()).toHaveLength(0)
    expect(boxes()).toEqual([true, true])
  })

  it('別の取引なら、そのまま入れる', async () => {
    readTradesFromImages.mockResolvedValue([
      {
        file: new File(['x'], 'shot.png'),
        trades: [trade(), trade({ openTime: '2026.09.04 18:11:00' })],
      },
    ])
    render(<BatchImport onSaved={() => {}} accountId="acc-1" />)
    await pick()

    expect(marks()).toHaveLength(0)
    expect(boxes()).toEqual([true, true])
  })

  it('照合できなくても、取り込みは止めない', async () => {
    findSavedTradeKeys.mockRejectedValue(new Error('つながりません'))
    readTradesFromImages.mockResolvedValue([
      { file: new File(['x'], 'shot.png'), trades: [trade()] },
    ])
    render(<BatchImport onSaved={() => {}} accountId="acc-1" />)
    await pick()

    expect(boxes()).toEqual([true])
  })

  it('スクショの指紋は、その画像から作った全部の取引に付ける', async () => {
    /*
      画像そのものは1件目にだけ付ける（重いので）。
      指紋まで1件目だけにすると、1件目の選択を外して登録したときに
      その画像の指紋がどこにも残らず、
      後日おなじ画像を選び直しても「取り込み済み」と言えなくなる。
    */
    readTradesFromImages.mockResolvedValue([
      {
        file: new File(['x'], 'shot.png'),
        trades: [trade(), trade({ openTime: '2026.09.04 18:11:00' })],
      },
    ])
    render(<BatchImport onSaved={() => {}} accountId="acc-1" />)
    await pick()

    // 1件目（画像が付いているほう）を外して登録する
    const first = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[0]
    fireEvent.click(first)
    fireEvent.click(screen.getByRole('button', { name: '1件を登録する' }))

    await waitFor(() => expect(insertTrades).toHaveBeenCalled())
    const [rows] = insertTrades.mock.calls[0] as unknown as [
      { screenshot: string | null; screenshot_hash: string | null }[],
    ]
    expect(rows).toHaveLength(1)
    expect(rows[0].screenshot).toBeNull() // 画像は付いていない
    expect(rows[0].screenshot_hash).toBe('hash-shot.png') // 指紋は残る
  })

  it('同じ時刻のものだけを照合する。取引が何件あっても引く量を増やさない', async () => {
    readTradesFromImages.mockResolvedValue([
      {
        file: new File(['x'], 'shot.png'),
        trades: [trade(), trade(), trade({ openTime: '2026.09.04 18:11:00' })],
      },
    ])
    render(<BatchImport onSaved={() => {}} accountId="acc-1" />)
    await pick()

    const [times, account] = findSavedTradeKeys.mock.calls[0] as unknown as [string[], string]
    // 同じ時刻は1つにまとめて聞く
    expect(times).toEqual([
      parseMt5DateTime('2026.09.04 15:30:12')!.toISOString(),
      parseMt5DateTime('2026.09.04 18:11:00')!.toISOString(),
    ])
    // 別の口座の同じ取引は別物なので、口座も渡す
    expect(account).toBe('acc-1')
  })
})
