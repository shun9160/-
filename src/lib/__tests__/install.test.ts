import { describe, expect, it } from 'vitest'
import { isIos, isIosSafari, shouldShowInstallHint } from '../install'
import type { Env } from '../install'

/**
 * ホーム画面への案内を出すかどうか。
 *
 * 出す相手を間違えると、書いてある手順が画面のどこにも無い、
 * という案内になる。iPhone の Safari 以外では「ホーム画面に追加」が
 * 出せないので、そこを外さないことがすべて。
 */

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1',
  iphoneFirefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
  // iPadOS 13 以降は Mac と名乗る
  ipad:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  mac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
}

function env(p: Partial<Env> = {}): Env {
  return {
    userAgent: UA.iphoneSafari,
    maxTouchPoints: 5,
    standalone: false,
    dismissed: false,
    ...p,
  }
}

describe('iPhone / iPad かどうか', () => {
  it('iPhone を見分ける', () => {
    expect(isIos(UA.iphoneSafari, 5)).toBe(true)
  })

  it('iPad は Mac と名乗るので、指で触れるかどうかで見分ける', () => {
    expect(isIos(UA.ipad, 5)).toBe(true)
    // 同じ名乗りでも、指で触れない Mac は違う
    expect(isIos(UA.mac, 0)).toBe(false)
  })

  it('Android は違う', () => {
    expect(isIos(UA.android, 5)).toBe(false)
  })
})

describe('iOS の Safari かどうか', () => {
  it('Safari なら true', () => {
    expect(isIosSafari(UA.iphoneSafari, 5)).toBe(true)
  })

  it('iPhone の Chrome / Firefox では出さない', () => {
    // 中身は Safari だが「ホーム画面に追加」が出せない。
    // 案内しても、書いてある手順が見つからない
    expect(isIosSafari(UA.iphoneChrome, 5)).toBe(false)
    expect(isIosSafari(UA.iphoneFirefox, 5)).toBe(false)
  })
})

describe('案内を出すか', () => {
  it('iPhone の Safari で、まだ置いていなければ出す', () => {
    expect(shouldShowInstallHint(env())).toBe(true)
  })

  it('すでにホーム画面から開いていれば出さない', () => {
    // いちばん恥ずかしい出し方。もう置いてある人に置き方を教えることになる
    expect(shouldShowInstallHint(env({ standalone: true }))).toBe(false)
  })

  it('一度閉じたら、二度と出さない', () => {
    expect(shouldShowInstallHint(env({ dismissed: true }))).toBe(false)
  })

  it('Android では出さない', () => {
    // ブラウザのほうから「インストールしますか」と聞いてくれる
    expect(shouldShowInstallHint(env({ userAgent: UA.android }))).toBe(false)
  })

  it('パソコンでは出さない', () => {
    expect(shouldShowInstallHint(env({ userAgent: UA.mac, maxTouchPoints: 0 }))).toBe(false)
  })

  it('iPad では出す', () => {
    expect(shouldShowInstallHint(env({ userAgent: UA.ipad, maxTouchPoints: 5 }))).toBe(true)
  })
})
