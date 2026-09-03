import { describe, expect, it } from 'vitest'
import { summarize } from '../connectionCheck'
import type { Reach, Report } from '../connectionCheck'
import { isNetworkError } from '../errors'
import { friendlyError } from '../errors'

/**
 * どこで止まっているかの切り分け。
 *
 * 「つながりません」で終わると、利用者にできることが何も無い。
 * 端末の電波なのか、保存先が止まっているのかで、やることがまるで違うので、
 * そこを言い分けられることを確かめる。
 */

const ok: Reach = { ok: true, status: 200 }
const unreachable: Reach = { ok: false, status: null, error: 'Load failed' }
const errorStatus = (status: number): Reach => ({ ok: false, status })

function report(p: Partial<Report> = {}): Report {
  return { online: true, app: ok, supabase: ok, ...p }
}

describe('通信の失敗を、ブラウザごとの言い方で見分ける', () => {
  it('Safari の「Load failed」を取りこぼさない', () => {
    // これを見落としていたので、iPhone では英語がそのまま画面に出ていた
    expect(isNetworkError('Load failed')).toBe(true)
  })

  it('Chrome と Firefox の言い方も見分ける', () => {
    expect(isNetworkError('Failed to fetch')).toBe(true)
    expect(isNetworkError('NetworkError when attempting to fetch resource.')).toBe(true)
  })

  it('通信と関係ないエラーは、そのまま通す', () => {
    expect(isNetworkError('Invalid login credentials')).toBe(false)
    expect(isNetworkError('relation "public.day_notes" does not exist')).toBe(false)
  })

  it('通信の失敗は、日本語になって出る', () => {
    const msg = friendlyError(new Error('Load failed'))
    expect(msg).toContain('サーバーに接続できませんでした')
    // 英語をそのまま見せない
    expect(msg).not.toContain('Load failed')
  })

  it('ログインの間違いは、そのまま伝える', () => {
    // ここを通信エラー扱いにすると、パスワード違いが
    // 「電波を確かめてください」になって、永久に直らない
    expect(friendlyError(new Error('Invalid login credentials'))).toContain(
      'Invalid login credentials',
    )
  })
})

describe('どこで止まっているかの言い分け', () => {
  it('自分のサイトにも届かない → 端末側', () => {
    const s = summarize(report({ app: unreachable, online: false }))
    expect(s.blame).toBe('device')
    expect(s.title).toContain('インターネット')
  })

  it('サイトには届くが保存先に届かない → 保存先が止まっている', () => {
    const s = summarize(report({ supabase: unreachable }))
    expect(s.blame).toBe('supabase')
    expect(s.body).toContain('Supabase')
    // 無料プランの自動停止は、いちばん多い原因なので必ず触れる
    expect(s.body).toContain('自動で止まります')
  })

  it('保存先がキーを拒んだ → 設定の間違いだと分かる文にする', () => {
    for (const status of [401, 403]) {
      const s = summarize(report({ supabase: errorStatus(status) }))
      expect(s.blame).toBe('supabase')
      expect(s.body).toContain('VITE_SUPABASE_ANON_KEY')
    }
  })

  it('保存先が500番台 → 止まっていないか見てもらう', () => {
    const s = summarize(report({ supabase: errorStatus(503) }))
    expect(s.title).toContain('503')
    expect(s.body).toContain('停止')
  })

  it('保存先が設定されていない → 環境変数を見てもらう', () => {
    const s = summarize(report({ supabase: null }))
    expect(s.blame).toBe('config')
    expect(s.body).toContain('VITE_SUPABASE_URL')
  })

  it('どちらにも届く → つながりのせいではない、と言い切る', () => {
    const s = summarize(report())
    expect(s.blame).toBe('unknown')
    expect(s.body).toContain('メールアドレスとパスワード')
  })

  it('端末側の問題が最優先。保存先の結果に引きずられない', () => {
    // 自分のサイトにすら届いていないなら、保存先の結果は当てにならない
    const s = summarize(report({ app: unreachable, supabase: ok }))
    expect(s.blame).toBe('device')
  })
})

describe('日本語に直したあとでも、通信の失敗だと分かること', () => {
  it('直したあとの文も、通信の失敗として見分けられる', () => {
    // 画面が持っているのは直したあとの文だけ。
    // ここを見落とすと「どこで止まっているか調べる」が出てこない
    const shown = friendlyError(new Error('Load failed'))
    expect(isNetworkError(shown)).toBe(true)
  })

  it('ログインの間違いでは、調べる手は出さない', () => {
    expect(isNetworkError(friendlyError(new Error('Invalid login credentials')))).toBe(false)
  })
})
