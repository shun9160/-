import { useRef, useState } from 'react'
import type { Account, TradeInput } from '../lib/types'
import { accountLabel } from '../lib/types'
import { friendlyError } from '../lib/errors'
import { parseAuto } from '../lib/mt5Parser'
import { addTradeImages, insertTrades } from '../lib/repo'
import { seedTrades } from '../lib/seed'
import BatchImport from './BatchImport'
import BrokerMark from './BrokerMark'
import TradeForm from './TradeForm'
import Icon from './Icon'

interface Props {
  accounts: Account[]
  /** 画面上部で選ばれている口座。「すべて」なら null */
  selectedAccountId: string | null
  onChanged: () => void
  disabled?: boolean
  /** 保存できたら呼ぶ。ホームへ移して結果を見せる。 */
  onDone?: (message: string) => void
}

type Method = 'shots' | 'manual' | 'file'

export default function UploadPanel({
  accounts, selectedAccountId, onChanged, disabled, onDone,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [method, setMethod] = useState<Method>('shots')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  /** 「すべて」を見ているときに、この画面で選んだ記録先 */
  const [pickedId, setPickedId] = useState<string | null>(null)

  // 上で口座を選んでいればそこへ。「すべて」なら、
  // 口座が1つだけのときは迷いようがないのでその口座、
  // 2つ以上あるときは取り違えるので必ず選んでもらう。
  const accountId =
    selectedAccountId ?? (accounts.length === 1 ? accounts[0].id : pickedId)
  const target = accounts.find((a) => a.id === accountId) ?? null
  const mustChoose = accountId == null && accounts.length > 1
  const noAccount = accounts.length === 0

  /**
   * 保存できたときの後始末。
   * 記録したものがすぐ確認できるよう、ホームへ移って結果を知らせる。
   * 移り先が無い場合だけ、この画面に結果を出す。
   */
  function succeed(message: string) {
    if (onDone) onDone(message)
    else setMsg({ text: message, ok: true })
  }

  async function commit(
    rows: TradeInput[],
    label: string,
    charts: { image: string; hash: string }[] = [],
  ) {
    if (rows.length === 0) {
      setMsg({
        text: '取引を読み取れませんでした。MT5の「レポート → HTML」で書き出したファイルをお試しください。',
        ok: false,
      })
      return
    }
    setBusy(true)
    try {
      const saved = await insertTrades(rows, accountId)
      // 取引が出来てからチャートを貼る（1件登録のときだけ使う）
      if (charts.length && saved.length === 1) {
        await addTradeImages(
          saved[0].id,
          charts.map((c) => ({ image: c.image, hash: c.hash })),
        )
      }
      onChanged()
      succeed(`${label} ${saved.length}件保存しました`)
    } catch (e) {
      setMsg({ text: friendlyError(e), ok: false })
    } finally {
      setBusy(false)
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setBusy(true)
    setMsg(null)
    try {
      const all: TradeInput[] = []
      for (const file of files) {
        all.push(...parseAuto(file.name, await file.text()))
      }
      await commit(all, 'ファイルから')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 方法を選ぶ */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <MethodCard
          active={method === 'shots'}
          onClick={() => setMethod('shots')}
          icon="camera"
          title="スクショ"
          desc="何枚でもまとめて"
        />
        <MethodCard
          active={method === 'file'}
          onClick={() => setMethod('file')}
          icon="upload"
          title="MT5レポート"
          desc="正確・一括"
        />
        <MethodCard
          active={method === 'manual'}
          onClick={() => setMethod('manual')}
          icon="pencil"
          title="手入力"
          desc="1件ずつ"
        />
      </div>

      {/* どの口座の記録かを必ずはっきりさせる */}
      {noAccount ? (
        <div className="rounded-2xl border border-down/25 bg-down-soft px-4 py-3 text-sm text-down">
          <p className="font-semibold">先に口座を登録してください</p>
          <p className="mt-0.5">上の「口座を登録する」から、ブローカー名と口座番号を入れてください。</p>
        </div>
      ) : mustChoose ? (
        <div className="card p-4">
          <p className="text-sm font-bold text-ink">どの口座の記録ですか？</p>
          <p className="mt-0.5 text-xs text-ink2">
            「すべての口座」を見ているため、記録先が決まっていません。選んでください。
          </p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {accounts.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setPickedId(a.id)}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-line px-3 py-2 text-left transition-colors hover:bg-sunken"
                >
                  <BrokerMark broker={a.broker} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {a.broker ?? accountLabel(a)}
                    </span>
                    <span className="block truncate text-[11px] tabular-nums text-ink3">
                      {a.login ?? '口座番号なし'}
                    </span>
                  </span>
                  <Icon name="right" size={16} className="shrink-0 text-ink3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        target && (
          <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2">
            <BrokerMark broker={target.broker} size={28} />
            <span className="min-w-0 flex-1 text-sm">
              <span className="text-ink3">記録先: </span>
              <span className="font-semibold text-ink">{target.broker ?? accountLabel(target)}</span>
              {target.login && <span className="ml-1.5 tabular-nums text-ink2">{target.login}</span>}
            </span>
            {selectedAccountId == null && accounts.length > 1 && (
              <button className="btn btn-ghost shrink-0 px-2 py-1" onClick={() => setPickedId(null)}>
                変える
              </button>
            )}
          </div>
        )
      )}

      {msg && (
        <div
          className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${
            msg.ok
              ? 'border-up/25 bg-up-soft text-up'
              : 'border-down/25 bg-down-soft text-down'
          }`}
        >
          <Icon name={msg.ok ? 'check' : 'info'} size={17} className="mt-0.5 shrink-0" />
          <p className="flex-1 font-semibold">{msg.text}</p>
        </div>
      )}

      {method === 'shots' ? (
        <BatchImport
          accountId={accountId}
          disabled={disabled || mustChoose || noAccount}
          onSaved={(n) => {
            onChanged()
            succeed(`スクショから ${n}件保存しました`)
          }}
        />
      ) : method === 'manual' ? (
        <div className="card p-4 sm:p-5">
          <TradeForm
            mode="add"
            disabled={mustChoose || noAccount}
            onSubmit={async (input, { charts }) => {
              await commit([input], '取引を', charts)
            }}
          />
        </div>
      ) : (
        <div className="card p-5">
          <h3 className="text-base font-bold">MT5のレポートを読み込む</h3>
          <ol className="mt-3 flex flex-col gap-2 text-sm text-ink2">
            <Step n={1}>パソコン版MT5の下部にある「口座履歴」タブを右クリック</Step>
            <Step n={2}>「レポート」→「HTML」を選んで保存</Step>
            <Step n={3}>下のボタンでそのファイルを選ぶ</Step>
          </ol>
          <button
            className="btn btn-primary mt-4 w-full sm:w-auto"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || busy || mustChoose || noAccount}
          >
            <Icon name="upload" size={17} />
            {busy ? '読み込み中…' : 'ファイルを選ぶ'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".html,.htm,.csv,.tsv,.txt"
            multiple
            className="hidden"
            onChange={onFile}
          />
          <p className="mt-2 text-xs text-ink3">
            CSVにも対応しています。同じ取引を二重に登録することはありません。
          </p>

          <div className="mt-5 border-t border-line pt-4">
            <p className="text-xs text-ink3">動作を試したいときは</p>
            <button
              className="btn btn-quiet mt-1.5"
              onClick={() => commit(seedTrades, 'サンプルを')}
              disabled={disabled || busy || mustChoose || noAccount}
            >
              サンプル2件を入れる
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MethodCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean
  onClick: () => void
  icon: 'camera' | 'upload' | 'pencil'
  title: string
  desc: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-colors ${
        active
          ? 'border-brand bg-brand-soft'
          : 'border-line bg-surface hover:bg-sunken'
      }`}
    >
      <span className={active ? 'text-brand' : 'text-ink3'}>
        <Icon name={icon} size={22} />
      </span>
      <span className={`text-sm font-bold ${active ? 'text-brand' : 'text-ink'}`}>{title}</span>
      <span className="text-xs text-ink2">{desc}</span>
    </button>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sunken text-[11px] font-bold text-ink2">
        {n}
      </span>
      {children}
    </li>
  )
}
