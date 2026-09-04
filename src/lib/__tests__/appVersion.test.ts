import { describe, expect, it } from 'vitest'
import { assetsFrom, hasNewBuild } from '../appVersion'

/**
 * 新しい版が出ているかの見分け。
 *
 * ここを間違えると2通りの困り方をする。
 *  見落とす … 直した不具合が、その人の端末にだけ残り続ける
 *  出しすぎ … 開くたびに「新しい版があります」が出て、信用されなくなる
 * どちらも静かに起きるので、判定だけは固めておく。
 */

/** 配信されている index.html の形。Vite が出すのとほぼ同じ */
const html = (js: string, css: string) => `<!doctype html>
<html lang="ja"><head>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
  <script type="module" crossorigin src="${js}"></script>
  <link rel="stylesheet" crossorigin href="${css}">
</head><body><div id="root"></div></body></html>`

const A = html('/assets/index-AAA111.js', '/assets/index-AAA111.css')
const B = html('/assets/index-BBB222.js', '/assets/index-BBB222.css')

describe('HTML から部品を取り出す', () => {
  it('JSとCSSだけを拾う', () => {
    expect(assetsFrom(A)).toEqual(['/assets/index-AAA111.css', '/assets/index-AAA111.js'])
  })

  it('アイコンや置き場所の説明書は拾わない', () => {
    // これらは名前が変わらないので、版の違いを見分けるのに使えない
    const got = assetsFrom(A).join()
    expect(got).not.toContain('favicon')
    expect(got).not.toContain('manifest')
    expect(got).not.toContain('apple-touch-icon')
  })

  it('同じものが二度書いてあっても、1つに数える', () => {
    const dup = html('/assets/index-AAA111.js', '/assets/index-AAA111.js')
    expect(assetsFrom(dup)).toEqual(['/assets/index-AAA111.js'])
  })
})

describe('新しい版かどうか', () => {
  const currentA = assetsFrom(A)

  it('同じ部品なら、新しい版ではない', () => {
    expect(hasNewBuild(A, currentA)).toBe(false)
  })

  it('部品の名前が変わっていれば、新しい版', () => {
    expect(hasNewBuild(B, currentA)).toBe(true)
  })

  it('CSSだけ変わっていても気づく', () => {
    const cssOnly = html('/assets/index-AAA111.js', '/assets/index-CCC333.css')
    expect(hasNewBuild(cssOnly, currentA)).toBe(true)
  })

  it('あとから読み込んだ部品が手元に増えていても、新しい版とは言わない', () => {
    // 画面を見て回ると、分割された部品が増えていく。
    // それを「違う」と数えると、開くたびに知らせが出る
    const withExtra = [...currentA, '/assets/StatsPanel-ZZZ999.js']
    expect(hasNewBuild(A, withExtra)).toBe(false)
  })

  it('読み取れない中身なら、判断しない', () => {
    // 途中で切れた返事や、間に入った機器の案内ページを
    // 「新しい版」と読んでしまわないように
    expect(hasNewBuild('', currentA)).toBe(false)
    expect(hasNewBuild('<html><body>接続してください</body></html>', currentA)).toBe(false)
  })

  it('手元が空でも、配信側が読めていれば新しい版とみなす', () => {
    expect(hasNewBuild(A, [])).toBe(true)
  })
})
