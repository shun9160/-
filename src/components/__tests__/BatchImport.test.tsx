// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tradeKey } from '../../lib/tradeDedup'
import { parseMt5DateTime } from '../../lib/timezone'
import { fmtMoney } from '../../lib/format'

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

const mod = await import('../BatchImport')
const BatchImport = mod.default
const { draftNet, draftTotal } = mod

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

/**
 * 読み取り結果に出す損益。
 *
 * ここを見て「入れる・外す」を決める人がいるので、
 * 切れて見えない・0円に見える、のどちらも起こしてはいけない。
 */
/**
 * 行の中の、額そのものを持つところ。
 * 下の合計にも同じ額が出るし、額は入れ物の span に包まれているので、
 * 「行の中」かつ「中に何も入っていない」ところまで絞る
 */
const moneyInRow = (text: string) => {
  const row = document.querySelector('article') as HTMLElement
  const el = [...row.querySelectorAll('span')].find(
    (x) => x.textContent === text && x.children.length === 0,
  )
  if (!el) throw new Error(`行の中に ${text} が見つからない`)
  return el
}

describe('読み取り結果の損益', () => {
  it('手数料を引いたあとの額を出す。登録後に並ぶ数字と同じにする', () => {
    expect(draftNet({ profit: '1262', commission: '-20' })).toBe(1242)
    expect(draftNet({ profit: '-3970', commission: '0' })).toBe(-3970)
  })

  it('手数料が読めていなければ、損益だけで出す', () => {
    expect(draftNet({ profit: '86', commission: '' })).toBe(86)
  })

  it('損益が読めていなければ、0円にしない', () => {
    // 0 と「読めなかった」は別のこと。0 に丸めると、
    // 0円の取引として登録してしまう
    expect(draftNet({ profit: '', commission: '0' })).toBeNull()
    expect(draftNet({ profit: 'よめない', commission: '0' })).toBeNull()
  })

  it('合計は、選んだぶんだけを足す。読めなかったぶんは数で出す', () => {
    expect(
      draftTotal([
        { profit: '1262', commission: '-20' },
        { profit: '-3970', commission: '0' },
        { profit: '', commission: '' },
      ]),
    ).toEqual({ sum: -2728, unknown: 1 })
  })

  it('チェックを外すと合計から抜ける', async () => {
    readTradesFromImages.mockResolvedValue([
      {
        file: new File(['x'], 'shot.png'),
        trades: [
          trade({ profit: 1262 }),
          trade({ profit: -3970, openTime: '2026.09.08 07:39:01' }),
        ],
      },
    ])
    render(<BatchImport onSaved={() => {}} accountId="acc-1" />)
    await pick()

    // 数の書き方はアプリの決まりに任せる（マイナス記号の形など）
    const bar = () => screen.getByText(/を登録します/).parentElement as HTMLElement
    expect(bar().textContent).toContain(fmtMoney(-2708, { sign: true }))

    // 負けのほうを外す
    fireEvent.click(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1])
    expect(bar().textContent).toContain(fmtMoney(1262, { sign: true }))
  })

  it('時刻が長くても、額は切れずに出る', async () => {
    // 「2026.09.08 06:12:22 損…」で切れていた。
    // 額のほうは縮めない場所に置く
    readTradesFromImages.mockResolvedValue([
      { file: new File(['x'], 'shot.png'), trades: [trade({ profit: 5431 })] },
    ])
    render(<BatchImport onSaved={() => {}} accountId="acc-1" />)
    await pick()

    const money = moneyInRow(fmtMoney(5431, { sign: true }))
    expect(money.className).not.toContain('truncate')
    const shrinkable = money.closest('.shrink-0')
    expect(shrinkable).not.toBeNull()
  })

  it('額は大きい字で出す。小さいままだと勝ちの緑が基準を割る', async () => {
    // 勝ちの緑は白の上で 3.3 しかない。
    // 太字で 18.66px を超えていれば「大きい字」として通る
    readTradesFromImages.mockResolvedValue([
      { file: new File(['x'], 'shot.png'), trades: [trade({ profit: 5431 })] },
    ])
    render(<BatchImport onSaved={() => {}} accountId="acc-1" />)
    await pick()

    const money = moneyInRow(fmtMoney(5431, { sign: true }))
    expect(money.className).toContain('text-[19px]')
    expect(money.className).toContain('font-bold')
  })

  it('損益が読めなかった行は、そう言う。空欄にしない', async () => {
    readTradesFromImages.mockResolvedValue([
      { file: new File(['x'], 'shot.png'), trades: [trade({ profit: null })] },
    ])
    render(<BatchImport onSaved={() => {}} accountId="acc-1" />)
    await pick()

    expect(screen.getByText('損益 読み取れず')).toBeTruthy()
  })
})
