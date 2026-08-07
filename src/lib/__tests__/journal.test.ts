import { describe, expect, it } from 'vitest'
import { emptyEntry, isEmpty, newImage, newText, parseEntry, plainText } from '../journal'

describe('parseEntry', () => {
  it('行が無い日はまっさらな日記になる', () => {
    const e = parseEntry('2026-08-07', null)
    expect(e.day).toBe('2026-08-07')
    expect(e.title).toBe('')
    expect(e.blocks).toHaveLength(1)
    expect(e.blocks[0].kind).toBe('text')
    expect(e.emotions).toEqual([])
  })

  it('これまでの note しか無い日は、それを本文として引き継ぐ', () => {
    const e = parseEntry('2026-08-07', { note: '早く入りすぎた。' })
    expect(e.blocks).toHaveLength(1)
    expect(e.blocks[0]).toMatchObject({ kind: 'text', text: '早く入りすぎた。' })
  })

  it('本文があれば note より本文を使う', () => {
    const e = parseEntry('2026-08-07', {
      note: 'ふるいもの',
      body_blocks: [{ id: 'b1', kind: 'text', text: 'あたらしいもの' }],
    })
    expect(e.blocks).toHaveLength(1)
    expect(e.blocks[0]).toMatchObject({ text: 'あたらしいもの' })
  })

  it('文章と画像が混ざった本文を読める', () => {
    const e = parseEntry('2026-08-07', {
      body_blocks: [
        { id: 'b1', kind: 'text', text: '待った。' },
        { id: 'b2', kind: 'image', path: 'u/journal/a.webp', caption: '入った場所' },
        { id: 'b3', kind: 'text', text: '早く閉じた。' },
      ],
    })
    expect(e.blocks.map((b) => b.kind)).toEqual(['text', 'image', 'text'])
    expect(e.blocks[1]).toMatchObject({ path: 'u/journal/a.webp', caption: '入った場所' })
  })

  it('壊れた中身が入っていても落ちない', () => {
    const e = parseEntry('2026-08-07', {
      body_blocks: [null, 42, { kind: 'image' }, { id: 'ok', kind: 'text', text: 'のこる' }],
    } as never)
    expect(e.blocks).toHaveLength(1)
    expect(e.blocks[0]).toMatchObject({ text: 'のこる' })
  })

  it('本文が空の配列なら、書き始められる塊を1つ用意する', () => {
    const e = parseEntry('2026-08-07', { body_blocks: [] })
    expect(e.blocks).toHaveLength(1)
    expect(e.blocks[0].kind).toBe('text')
  })

  it('題名・気持ち・振り返り・学びをそのまま読む', () => {
    const e = parseEntry('2026-08-07', {
      title: 'ルール通り待てた日',
      emotions: ['calm', 'confident'],
      emotion_why: 'しっかり待てたから',
      good: '待てた',
      improve: '早く閉じた',
      next_time: '決めた場所まで持つ',
      lesson: '追いかけない',
    })
    expect(e.title).toBe('ルール通り待てた日')
    expect(e.emotions).toEqual(['calm', 'confident'])
    expect(e.emotionWhy).toBe('しっかり待てたから')
    expect(e.good).toBe('待てた')
    expect(e.improve).toBe('早く閉じた')
    expect(e.nextTime).toBe('決めた場所まで持つ')
    expect(e.lesson).toBe('追いかけない')
  })
})

describe('plainText', () => {
  it('文章をつなげ、画像は説明文だけを拾う', () => {
    const out = plainText([
      newText('一行目'),
      newImage('u/a.webp', 'チャートの説明'),
      newText('二行目'),
    ])
    expect(out).toBe('一行目\n\nチャートの説明\n\n二行目')
  })

  it('空の塊は飛ばす', () => {
    expect(plainText([newText(''), newText('  '), newText('あり')])).toBe('あり')
  })

  it('説明の無い画像だけなら空になる', () => {
    expect(plainText([newImage('u/a.webp')])).toBe('')
  })
})

describe('isEmpty', () => {
  it('作りたてはからっぽ', () => {
    expect(isEmpty(emptyEntry('2026-08-07'))).toBe(true)
  })

  it('題名だけでも、からっぽではない', () => {
    expect(isEmpty({ ...emptyEntry('2026-08-07'), title: 'あ' })).toBe(false)
  })

  it('気持ちを選んだだけでも、からっぽではない', () => {
    expect(isEmpty({ ...emptyEntry('2026-08-07'), emotions: ['calm'] })).toBe(false)
  })

  it('学びだけでも、からっぽではない', () => {
    expect(isEmpty({ ...emptyEntry('2026-08-07'), lesson: '待つ' })).toBe(false)
  })

  it('画像を1枚貼っただけでも、からっぽではない', () => {
    expect(isEmpty({ ...emptyEntry('2026-08-07'), blocks: [newImage('u/a.webp')] })).toBe(false)
  })

  it('空白だけの文章は、書いたことにならない', () => {
    expect(isEmpty({ ...emptyEntry('2026-08-07'), blocks: [newText('   \n  ')] })).toBe(true)
  })
})
