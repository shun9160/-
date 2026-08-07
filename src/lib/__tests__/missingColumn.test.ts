import { describe, expect, it } from 'vitest'
import { missingColumnName } from '../repo'

/**
 * 移行SQLを途中まで流した状態でも、日記が書けなくならないための仕組み。
 * 「その列がない」と言われたとき、その列だけを落として書き直す。
 */
describe('missingColumnName', () => {
  it('書き込みのときの言い方から取り出す', () => {
    expect(
      missingColumnName({
        message: "Could not find the 'photos' column of 'day_notes' in the schema cache",
      }),
    ).toBe('photos')
  })

  it('読み込みのときの言い方から取り出す', () => {
    expect(missingColumnName({ message: 'column day_notes.body_blocks does not exist' })).toBe(
      'body_blocks',
    )
  })

  it('引用符が付いていても取り出す', () => {
    expect(missingColumnName({ message: 'column "lesson" does not exist' })).toBe('lesson')
  })

  it('関係ないエラーでは null を返す（握りつぶさない）', () => {
    expect(missingColumnName({ message: 'permission denied for table day_notes' })).toBeNull()
    expect(missingColumnName({ message: 'relation "day_notes" does not exist' })).toBeNull()
    expect(missingColumnName(null)).toBeNull()
    expect(missingColumnName(new Error('network error'))).toBeNull()
  })
})
