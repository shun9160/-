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

/** 「困ったときの入口」の合言葉。/?reset=1 で全部やり直す */
export const RESET_PARAM = 'reset'

/** いま、やり直しを頼まれているか */
export function isResetRequested(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).has(RESET_PARAM)
}

/**
 * 受け付け係と控えを、まるごと捨てる。
 *
 * 万が一おかしな係を配ってしまうと、利用者の端末では
 * 古い画面が出続ける。iPhone では「アプリを消して入れ直す」以外に
 * 直す手立てが無く、そこまでする人はまずいない。
 *
 * だから逃げ道をひとつ作っておく。/?reset=1 を開けば元に戻る。
 * 保存したものには触らない。捨てるのは控えだけ。
 */
export async function resetServiceWorker(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)))
    }
    if ('caches' in window) {
      const names = await caches.keys()
      await Promise.all(names.map((n) => caches.delete(n).catch(() => false)))
    }
  } catch {
    // 消せなくても、このあと開き直すところまでは進める
  }
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
