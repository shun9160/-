/*
 * 画面を持ち歩けるようにするための、小さな受け付け係。
 *
 * やること
 *   - 一度読んだ見た目のファイルを控えておき、2回目から一瞬で開く
 *   - 電波が無いときでも、アプリの形だけは出す
 *
 * やらないこと（大事）
 *   - 取引や日記そのものは控えない。Supabase への行き来には触らない。
 *     ここで古い中身を返すと、消したはずの取引が生き返る
 *   - 文字認識のファイル（/tesseract、23MB）は控えない。
 *     黙って23MB置いていくのは、こちらの都合が過ぎる
 *
 * 新しい版の出し方
 *   画面(HTML)は毎回インターネットを先に見る。だから配信し直せば、
 *   次に開いたときには新しい版になる。
 *   この係そのものは、開いているタブが全部閉じるまで交代しない。
 *   途中で入れ替えると、古い画面が古い部品を探しに行って壊れることがある。
 */

/** 中身を変えたら、ここの数字を上げる。古い控えは捨てられる */
const VERSION = 'v1'
const CACHE = `fxbook-${VERSION}`

/** 電波が無いときに出す、最低限のもの */
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      // 前の版の控えを片付ける
      const names = await caches.keys()
      await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
      await self.clients.claim()
    })(),
  )
})

/*
 * 画面からの頼まれごと。
 *
 * 「いま開くのに使ったファイル」の名前が届く。
 * 初めて来た日の読み込みは、この係が仕事を始める前に終わっているので、
 * こちらからは見えていない。だから画面から教えてもらって控える。
 * これが無いと、置いた初日に電波が切れたとき真っ白になる。
 */
self.addEventListener('message', (e) => {
  const msg = e.data
  if (!msg || msg.type !== 'cache-assets' || !Array.isArray(msg.urls)) return

  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      const mine = msg.urls.filter((u) => {
        try {
          const url = new URL(u, self.location.origin)
          return url.origin === self.location.origin && url.pathname.startsWith('/assets/')
        } catch {
          return false
        }
      })
      // 1つ失敗しても、ほかは控えたい。まとめてではなく1つずつ
      await Promise.all(mine.map((u) => cache.add(u).catch(() => {})))
    })(),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  // 自分のところ以外（Supabase・Stripe など）には手を出さない
  if (url.origin !== self.location.origin) return
  // 受け口も、文字認識の重いファイルも素通し
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname.startsWith('/tesseract/')) return

  // 画面そのもの。まずインターネット、だめなら控え。
  // 逆にすると、配信し直しても古い画面が出続ける
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          put(req, res.clone())
          return res
        })
        .catch(async () => (await caches.match(req)) ?? (await caches.match('/')) ?? offline()),
    )
    return
  }

  // 見た目のファイル。名前に中身の指紋が入っていて、
  // 中身が変われば名前も変わる。だから控えをそのまま出してよい
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            put(req, res.clone())
            return res
          }),
      ),
    )
  }
})

function put(req, res) {
  // 途中で切れた返事や、部分的な返事は控えない
  if (!res || res.status !== 200 || res.type === 'opaque') return
  caches.open(CACHE).then((c) => c.put(req, res)).catch(() => {})
}

function offline() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><title>FX BOOK</title>' +
      '<body style="font-family:system-ui;padding:3rem 1.5rem;color:#16151F;background:#F1F0F6">' +
      '<p style="font-weight:700">つながりませんでした</p>' +
      '<p style="color:#6B6A7B;font-size:14px">電波の届くところで、もう一度ひらいてください。</p>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 },
  )
}
