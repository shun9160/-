/**
 * どこで止まっているのかを調べる。
 *
 * 「つながりません」とだけ出ても、直しようがない。
 * 端末の電波が悪いのか、こちらのサイトが落ちているのか、
 * データの置き場所（Supabase）が止まっているのかで、やることが違う。
 *
 * だから2か所に順番に声をかけて、どこまで届くかを見る。
 *   1) このサイト自身  … 端末がインターネットに出られているか
 *   2) Supabase        … データの置き場所が応答するか
 *
 * ここでは判定だけを持ち、画面には出さない。
 * 実機を持ち出さずに確かめられるようにするため。
 */

/** どこまで届いたか */
export type Reach =
  | { ok: true; status: number }
  /** 返事はあったが、正常ではない（止まっている・設定が違う など） */
  | { ok: false; status: number }
  /** そもそも届かない（電波・DNS・遮断） */
  | { ok: false; status: null; error: string }

export interface Report {
  /** 端末がインターネットに出られていると自称しているか */
  online: boolean
  /** このサイト自身へ */
  app: Reach
  /** データの置き場所へ。URLが未設定なら null */
  supabase: Reach | null
}

/** 届いたかどうかだけを見る短い形 */
function reached(r: Reach | null): boolean {
  return r != null && r.ok
}

/**
 * 調べた結果を、人が読んで次にやることが分かる文にする。
 *
 * 専門用語は使わない。読むのは、原因ではなく
 * 「自分がいま何をすればいいか」を知りたい人なので。
 */
export function summarize(r: Report): { title: string; body: string; blame: Blame } {
  // 自分のサイトにも届いていない = 端末側の問題
  if (!reached(r.app)) {
    return {
      blame: 'device',
      title: 'インターネットにつながっていないようです',
      body: '電波の届くところに移るか、Wi-Fiを切り替えてから、もう一度お試しください。',
    }
  }

  if (r.supabase == null) {
    return {
      blame: 'config',
      title: 'データの保存先が設定されていません',
      body: 'Netlify の環境変数（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）をご確認ください。',
    }
  }

  // サイトには届くのに置き場所に届かない = 向こう側
  if (!r.supabase.ok && r.supabase.status == null) {
    return {
      blame: 'supabase',
      title: 'データの保存先に届きませんでした',
      body:
        'この端末はインターネットにつながっています。保存先（Supabase）だけが応答していません。' +
        'Supabase のプロジェクトが停止していないかご確認ください。' +
        '無料プランは、しばらく使わないと自動で止まります。',
    }
  }

  if (!r.supabase.ok) {
    return {
      blame: 'supabase',
      title: `データの保存先がエラーを返しました（${r.supabase.status}）`,
      body:
        r.supabase.status === 401 || r.supabase.status === 403
          ? 'キーが違うかもしれません。Netlify の VITE_SUPABASE_ANON_KEY をご確認ください。'
          : 'Supabase のプロジェクトが停止していないかご確認ください。',
    }
  }

  // 両方に届く。つながりの問題ではない
  return {
    blame: 'unknown',
    title: 'つながりは問題ありませんでした',
    body:
      'この端末からデータの保存先まで届いています。' +
      'それでもログインできない場合は、メールアドレスとパスワードをご確認ください。',
  }
}

export type Blame = 'device' | 'supabase' | 'config' | 'unknown'

/** 1か所に声をかける。届かなければ status は null */
async function probe(url: string, headers: Record<string, string> = {}): Promise<Reach> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      // 途中の控えを見ずに、いまの状態を確かめる
      cache: 'no-store',
    })
    return res.ok ? { ok: true, status: res.status } : { ok: false, status: res.status }
  } catch (e) {
    return { ok: false, status: null, error: e instanceof Error ? e.message : String(e) }
  }
}

interface Options {
  origin: string
  supabaseUrl?: string
  anonKey?: string
  online: boolean
  /** 待ちすぎない。調べるだけなのに固まっては意味がない(ms) */
  timeout?: number
}

export async function checkConnection(o: Options): Promise<Report> {
  const withTimeout = <T>(p: Promise<T>, fallback: T): Promise<T> =>
    Promise.race([p, delay(o.timeout ?? 6000).then(() => fallback)])

  const timedOut: Reach = { ok: false, status: null, error: '時間内に返事がありませんでした' }

  const app = await withTimeout(
    // 自分のサイトの、いちばん軽いもの
    probe(`${o.origin}/manifest.webmanifest?t=${Date.now()}`),
    timedOut,
  )

  const supabase =
    o.supabaseUrl && o.anonKey
      ? await withTimeout(
          // 置き場所の「生きているか」を聞くところ
          probe(`${o.supabaseUrl.replace(/\/$/, '')}/auth/v1/health`, { apikey: o.anonKey }),
          timedOut,
        )
      : null

  return { online: o.online, app, supabase }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
