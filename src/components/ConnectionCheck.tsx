import { useState } from 'react'
import { checkConnection, summarize } from '../lib/connectionCheck'
import type { Blame, Report } from '../lib/connectionCheck'
import { supabaseUrl, supabaseAnonKey } from '../lib/supabase'
import Icon from './Icon'

/**
 * どこで止まっているのかを調べるボタン。
 *
 * 「つながりません」とだけ出ても、利用者にできることが無い。
 * 端末の電波なのか、保存先が止まっているのかで、やることがまるで違う。
 * 押せば分かるようにしておく。
 *
 * 通信に失敗したときだけ出す。ふだんは出さない。
 * いつも置いてあると、アプリが不安定に見える。
 */
export default function ConnectionCheck() {
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<Report | null>(null)

  async function run() {
    setBusy(true)
    setReport(null)
    try {
      setReport(
        await checkConnection({
          origin: window.location.origin,
          supabaseUrl,
          anonKey: supabaseAnonKey,
          online: navigator.onLine,
        }),
      )
    } finally {
      setBusy(false)
    }
  }

  if (!report) {
    return (
      <button
        onClick={() => void run()}
        disabled={busy}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-bold text-down underline underline-offset-2 disabled:opacity-60"
      >
        {busy ? '調べています…' : 'どこで止まっているか調べる'}
      </button>
    )
  }

  const { title, body, blame } = summarize(report)
  return (
    <div className="mt-3 rounded-xl bg-surface px-4 py-3">
      <p className="flex items-start gap-2 text-[13px] font-bold">
        <Icon
          name={blame === 'unknown' ? 'check' : 'info'}
          size={16}
          className={`mt-0.5 shrink-0 ${blame === 'unknown' ? 'text-up' : 'text-down'}`}
        />
        <span>{title}</span>
      </p>
      <p className="mt-1.5 pl-6 text-[13px] leading-relaxed text-ink2">{body}</p>

      {/* 送ってもらえば、こちらで原因を追える控え */}
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pl-6 text-[12px] tabular-nums">
        <Row label="この端末" value={report.online ? 'オンライン' : 'オフライン'} />
        <Row label="このサイト" value={reachText(report.app)} />
        <Row label="保存先" value={report.supabase ? reachText(report.supabase) : '未設定'} />
      </dl>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-ink2">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </>
  )
}

function reachText(r: { ok: boolean; status: number | null }): string {
  if (r.ok) return '届いた'
  return r.status == null ? '届かない' : `エラー ${r.status}`
}

export type { Blame }
