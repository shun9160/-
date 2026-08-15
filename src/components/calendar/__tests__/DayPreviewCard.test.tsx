// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import DayPreviewCard from '../DayPreviewCard'

/**
 * 日記の入口になる1枚。
 *
 * 書いてある日は「冒頭がこの面に入るだけ出る」ことが要。
 * ここが空っぽに見えると、書いたのに残っていないように感じる。
 */

afterEach(cleanup)

const LONG = '1行目のみだし\n本文のつづき。ここから先が、面に入るだけ出てほしいところ。'

describe('DayPreviewCard', () => {
  it('何も書いていない日は、書き始める入口になる', () => {
    const { container } = render(
      <DayPreviewCard day="2026-08-15" title="" note="" isToday onOpen={() => {}} />,
    )
    const t = container.textContent ?? ''
    expect(t).toContain('今日のことを書く')
    expect(t).toContain('書きはじめる')
    expect(t).not.toContain('続きを読む')
  })

  it('今日でなければ、書き出しの誘い方が変わる', () => {
    const { container } = render(
      <DayPreviewCard day="2026-08-11" title="" note="" isToday={false} onOpen={() => {}} />,
    )
    expect(container.textContent).toContain('この日の振り返りを書く')
  })

  it('題名があれば見出しにして、本文の冒頭をその下に出す', () => {
    const { container } = render(
      <DayPreviewCard
        day="2026-08-14"
        title="焦った日"
        note={LONG}
        isToday={false}
        onOpen={() => {}}
      />,
    )
    const t = container.textContent ?? ''
    expect(t).toContain('焦った日')
    // 題名があるときは、本文は1行目から丸ごと続きに回す
    expect(t).toContain('1行目のみだし')
    expect(t).toContain('面に入るだけ出てほしいところ')
    expect(t).toContain('続きを読む')
  })

  it('題名が無ければ、本文の1行目を見出しに借りる。同じ文は二度出さない', () => {
    const { container } = render(
      <DayPreviewCard day="2026-08-13" title="" note={LONG} isToday={false} onOpen={() => {}} />,
    )
    const t = container.textContent ?? ''
    expect(t).toContain('1行目のみだし')
    expect(t.match(/1行目のみだし/g)).toHaveLength(1)
    expect(t).toContain('本文のつづき')
  })

  it('本文の改行は潰して1本にする。1文字の行で1行ぶん使わせない', () => {
    const { container } = render(
      <DayPreviewCard
        day="2026-08-12"
        title="題"
        note={'あ\n\nい\n\nう'}
        isToday={false}
        onOpen={() => {}}
      />,
    )
    const body = [...container.querySelectorAll('p')].map((p) => p.textContent)
    expect(body).toContain('あ い う')
  })

  it('1行しか書いていなければ、見出しだけ出す', () => {
    const { container } = render(
      <DayPreviewCard day="2026-08-12" title="" note="今日は見送り。" isToday={false} onOpen={() => {}} />,
    )
    const t = container.textContent ?? ''
    expect(t).toContain('今日は見送り。')
    expect(t).toContain('続きを読む')
  })

  it('押すと、その日と押した高さを返す', () => {
    let got: [string, number] | null = null
    const { container } = render(
      <DayPreviewCard
        day="2026-08-14"
        title="題"
        note=""
        isToday={false}
        onOpen={(d, y) => {
          got = [d, y]
        }}
      />,
    )
    container.querySelector('button')!.click()
    expect(got?.[0]).toBe('2026-08-14')
    expect(typeof got?.[1]).toBe('number')
  })
})
