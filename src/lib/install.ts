/**
 * ホーム画面への置き方の案内と、その判定。
 *
 * iPhone には「インストールしますか」の問い合わせが出ない。
 * Safari の共有ボタンから自分で「ホーム画面に追加」を選ぶしかなく、
 * 知らない人はまず気づかない。だから、こちらから一度だけ声をかける。
 *
 * 判定だけをここに分けてあるのは、実機を持ち出さずに確かめるため。
 */

/** 一度断られたことを覚えておく鍵 */
export const DISMISS_KEY = 'fxbook.install-hint.dismissed'

export interface Env {
  userAgent: string
  /** iPad は Mac と名乗るので、指で触れるかどうかも見る */
  maxTouchPoints: number
  /** すでにホーム画面から開いているか */
  standalone: boolean
  /** 前に「あとで」を押したか */
  dismissed: boolean
}

/** iPhone / iPad か */
export function isIos(ua: string, maxTouchPoints: number): boolean {
  if (/iPad|iPhone|iPod/.test(ua)) return true
  // iPadOS 13 以降は "Macintosh" と名乗る。指で触れるなら iPad とみなす
  return /Macintosh/.test(ua) && maxTouchPoints > 1
}

/**
 * iOS の Safari か。
 *
 * iPhone の Chrome や Firefox は、中身は Safari だが
 * 「ホーム画面に追加」が出せない。そこで案内すると、
 * 書いてある手順が見つからず、かえって迷わせる。
 */
export function isIosSafari(ua: string, maxTouchPoints: number): boolean {
  if (!isIos(ua, maxTouchPoints)) return false
  // Chrome(CriOS) / Firefox(FxiOS) / Edge(EdgiOS) / Opera(OPT) は除く
  return !/CriOS|FxiOS|EdgiOS|OPT\//.test(ua)
}

/** 案内を出すか */
export function shouldShowInstallHint(env: Env): boolean {
  if (env.standalone) return false
  if (env.dismissed) return false
  return isIosSafari(env.userAgent, env.maxTouchPoints)
}

/** いま、ホーム画面から開いているか */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // iOS だけ独自の印を持っている
  const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return ios || window.matchMedia('(display-mode: standalone)').matches
}

/** いまのブラウザから、判定に使う材料を集める */
export function readEnv(): Env {
  if (typeof window === 'undefined') {
    return { userAgent: '', maxTouchPoints: 0, standalone: false, dismissed: true }
  }
  let dismissed = false
  try {
    dismissed = window.localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    // 保存できない設定のときは、毎回出るより出さないほうがましなので断られた扱いにしない
  }
  return {
    userAgent: window.navigator.userAgent,
    maxTouchPoints: window.navigator.maxTouchPoints ?? 0,
    standalone: isStandalone(),
    dismissed,
  }
}

export function rememberDismissed(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    /* 保存できなくても、その場では閉じられる */
  }
}
