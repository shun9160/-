/**
 * ホーム画面に置いたときの受け付け係（Service Worker）を登録する。
 *
 * 開発中は登録しない。控えが残って、直したはずの画面が出ないという
 * いちばん分かりにくい詰まり方をするため。
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  if (!import.meta.env.PROD) return

  // 画面が出そろってから登録する。最初の表示と取り合わせない
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(cacheWhatIsAlreadyLoaded)
      .catch(() => {
        // 登録できなくても、アプリは普通に動く。黙って諦める
      })
  })
}

/**
 * いま開くのに使ったファイルを、受け付け係に控えてもらう。
 *
 * 係が仕事を始めるのは、ページが出来上がったあと。
 * だから初めて来た日の読み込みは、係の目に触れないまま終わっている。
 * そのままだと「ホーム画面に置いて、電車に乗って、開いたら真っ白」になる。
 * 置いた初日がそれでは、二度と開いてもらえない。
 *
 * そこで、読み込みに使ったファイルの名前をこちらから渡して、
 * 控えておいてもらう。
 */
function cacheWhatIsAlreadyLoaded(reg: ServiceWorkerRegistration): void {
  const worker = reg.active
  if (!worker) return

  const urls = performance
    .getEntriesByType('resource')
    .map((e) => e.name)
    .filter((u) => {
      try {
        const { origin, pathname } = new URL(u)
        // 自分のところの、見た目のファイルだけ。
        // 文字認識の23MBや、通信のやり取りは渡さない
        return origin === window.location.origin && pathname.startsWith('/assets/')
      } catch {
        return false
      }
    })

  if (urls.length) worker.postMessage({ type: 'cache-assets', urls })
}
