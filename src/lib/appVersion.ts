/**
 * 新しい版が配信されていないかを見る。
 *
 * ホーム画面から開くようにすると、iPhone はアプリを閉じずに
 * ページを生かしたまま復帰させることが多い。そのとき
 * 画面の読み込みが起きないので、何日も古いままになる。
 * 直したはずの不具合がその人の端末にだけ残り続ける。
 *
 * 見分け方は単純にした。配信されている index.html を読んで、
 * そこが指している部品の名前が、いま動かしているものと違えば新しい版。
 * 部品の名前には中身の指紋が入っていて、中身が変われば名前も変わる。
 *
 * 版の番号をどこかに持たせる手もあるが、
 * 「番号を上げ忘れて気づかない」が必ず起きるのでやめた。
 */

/** HTML が指している部品（JS と CSS）の場所を取り出す */
export function assetsFrom(html: string): string[] {
  const out = new Set<string>()
  for (const m of html.matchAll(/(?:src|href)\s*=\s*["'](\/assets\/[^"']+\.(?:js|css))["']/g)) {
    out.add(m[1])
  }
  return [...out].sort()
}

/**
 * 新しい版か。
 *
 * 「配信されている側にあって、いま動かしている側に無い」部品が
 * 1つでもあれば新しい版とみなす。
 *
 * 逆向き（動かしている側にしか無い）は見ない。
 * 後から読み込む部分は、開いた画面によって増えていくため。
 */
export function hasNewBuild(html: string, current: string[]): boolean {
  const wanted = assetsFrom(html)
  // 読み取れなければ、判断しない。出どころが怪しいのに
  // 「新しい版です」と出すほうが困る
  if (wanted.length === 0) return false
  const have = new Set(current)
  return wanted.some((w) => !have.has(w))
}

/** いま動かしている部品の場所。画面に貼られているものをそのまま読む */
export function currentAssets(): string[] {
  if (typeof document === 'undefined') return []
  const out = new Set<string>()
  document.querySelectorAll<HTMLScriptElement>('script[src]').forEach((el) => {
    const p = pathOf(el.src)
    if (p?.startsWith('/assets/')) out.add(p)
  })
  document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]').forEach((el) => {
    const p = pathOf(el.href)
    if (p?.startsWith('/assets/')) out.add(p)
  })
  return [...out].sort()
}

function pathOf(url: string): string | null {
  try {
    return new URL(url, window.location.origin).pathname
  } catch {
    return null
  }
}

/**
 * 配信元に聞きにいく。
 *
 * 控えを見ずに、いまそこにあるものを取る。
 * 控えを見ると、古い index.html と見比べることになって
 * いつまでも「新しい版はありません」になる。
 */
export async function checkForUpdate(): Promise<boolean> {
  try {
    const res = await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return false
    return hasNewBuild(await res.text(), currentAssets())
  } catch {
    // 電波が無いだけかもしれない。何も言わない
    return false
  }
}
