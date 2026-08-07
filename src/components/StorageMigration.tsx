import { useEffect, useState } from 'react'
import { countUnmigratedImages, migrateImagesToStorage } from '../lib/repo'
import { friendlyError } from '../lib/errors'
import Icon from './Icon'

/**
 * 昔の画像を、データベースからファイル置き場へ移す。
 *
 * これまで画像はデータベースの中に文字として入っていた。文字にすると
 * 容量が約1.33倍に膨らむうえ、データベースの保管料は置き場より高い。
 *
 * 一度に全部やると端末が固まるので、5枚ずつ進める。
 * 途中で画面を閉じても、続きから再開できる（移した行から順に消していく）。
 */
export default function StorageMigration() {
  const [left, setLeft] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [moved, setMoved] = useState(0)
  const [failed, setFailed] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    countUnmigratedImages()
      .then(setLeft)
      .catch(() => setLeft(0))
  }, [])

  async function run() {
    setRunning(true)
    setErr(null)
    setDone(false)
    let total = 0
    let bad = 0
    try {
      // 残りが無くなるまで、5枚ずつ繰り返す
      for (;;) {
        const r = await migrateImagesToStorage()
        total += r.moved
        bad += r.failed
        setMoved(total)
        setFailed(bad)
        setLeft(r.remaining)
        if (r.remaining === 0) break
        // この回で1枚も移せなかったなら、続けても同じなので止める
        if (r.moved === 0) break
      }
      setDone(true)
    } catch (e) {
      setErr(friendlyError(e))
    } finally {
      setRunning(false)
    }
  }

  // 数え終わる前と、移すものが無いときは何も出さない
  if (left == null) return null
  if (left === 0 && !done) return null

  return (
    <section className="card p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Icon name="upload" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold">画像の置き場所を移す</h2>
          <p className="mt-1 text-sm text-ink2">
            以前に貼ったチャート画像が、データベースの中に入ったままです。
            ファイル置き場へ移すと、表示が速くなり、保管の費用も下がります。
            見た目は変わりません。
          </p>

          {left > 0 && (
            <p className="mt-2 text-sm font-semibold tabular-nums">
              残り {left} 枚
            </p>
          )}

          {(moved > 0 || failed > 0) && (
            <p className="mt-1 text-xs text-ink3 tabular-nums">
              移せた {moved} 枚
              {failed > 0 && <span className="text-down"> ／ 移せなかった {failed} 枚</span>}
            </p>
          )}

          {done && left === 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-up">
              <Icon name="check" size={16} />
              すべて移りました
            </p>
          )}

          {err && (
            <p className="mt-2 rounded-xl border border-down/25 bg-down-soft px-3 py-2 text-sm text-down">
              {err}
            </p>
          )}

          {left > 0 && (
            <>
              <button className="btn btn-primary mt-3" onClick={run} disabled={running}>
                {running ? '移しています…' : '移す'}
              </button>
              <p className="mt-2 text-[11px] text-ink3">
                枚数が多いと時間がかかります。この画面を開いたままにしてください。
                途中で閉じても、次に開いたとき続きから再開できます。
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
