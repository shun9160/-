import { useState } from 'react'
import type { PlanState } from '../lib/plan'
import {
  CREDIT_PACK,
  FREE_DAYS,
  PLANS,
  imageLimitOf,
  imagesLeft,
  periodLabel,
  priceLabel,
} from '../lib/plan'
import { startCheckout } from '../lib/billing'
import { friendlyError } from '../lib/errors'
import Icon from './Icon'

/**
 * 料金。
 *
 * 書き方の決まりごと:
 *  - できないことを先に書く。あとから「実は読めない」と分かるのがいちばん悪い
 *  - 「消える」と誤解させない。無料に戻っても記録は残り、読めなくなるだけ
 *  - いま自分がどの状態かを、いちばん上に出す。値段表より先に知りたいこと
 *
 * 数字はすべて lib/plan.ts の1か所から来る。ここで直に書かない。
 * 表と請求がずれるのが、いちばん信用を落とす。
 */

interface Props {
  state: PlanState
  /** 読み込み中か */
  loading?: boolean
  onBack: () => void
  /** 支払いのあと戻ってくる先。Stripe に渡す */
  returnUrl?: string
}

type Busy = 'pro' | 'credit' | 'portal' | null

export default function PricingScreen({ state, loading, onBack, returnUrl }: Props) {
  const [busy, setBusy] = useState<Busy>(null)
  const [err, setErr] = useState<string | null>(null)

  const isPro = state.plan === 'pro'
  const until = periodLabel(state.periodEnd)

  async function go(kind: 'pro' | 'credit' | 'portal') {
    setBusy(kind)
    setErr(null)
    try {
      const url = await startCheckout(kind, returnUrl ?? window.location.href)
      window.location.href = url
    } catch (e) {
      setErr(friendlyError(e))
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-[46rem]">
      <button className="btn btn-ghost mb-3 -ml-2" onClick={onBack}>
        <Icon name="back" size={17} />
        戻る
      </button>

      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">料金</h1>
        <p className="mt-0.5 text-sm text-ink2">
          書くことは、どのプランでも制限していません。変わるのは「どこまで読み返せるか」です。
        </p>
      </div>

      {/* いまの状態。値段表より先に、自分がどこにいるかを出す */}
      <section className="rounded-2xl bg-surface px-5 py-4">
        {loading ? (
          <p className="text-sm text-ink2">読み込み中…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[12px] font-semibold text-ink2">いまのプラン</span>
              <span
                className={`rounded-md px-2 py-0.5 text-[13px] font-bold ${
                  isPro ? 'bg-brand text-white' : 'bg-sunken text-ink2'
                }`}
              >
                {PLANS[state.plan].name}
              </span>
              {isPro && until && (
                <span className="text-[12px] text-ink2">
                  {state.cancelAtPeriodEnd ? `${until}まで（更新しません）` : `次回の更新 ${until}`}
                </span>
              )}
            </div>

            {/* 画像の枠。クレジットを足す意味がここで分かる */}
            <div className="mt-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] text-ink2">チャート画像</span>
                <span className="text-[13px] font-bold tabular-nums">
                  {state.usedImages.toLocaleString('ja-JP')} /{' '}
                  {imageLimitOf(state).toLocaleString('ja-JP')} 枚
                </span>
              </div>
              <Meter used={state.usedImages} max={imageLimitOf(state)} />
              <p className="mt-1.5 text-[12px] text-ink2">
                あと {imagesLeft(state).toLocaleString('ja-JP')} 枚
                {state.extraImages > 0 &&
                  `（買い足したぶん ${state.extraImages.toLocaleString('ja-JP')} 枚を含む）`}
              </p>
            </div>
          </>
        )}
      </section>

      {err && (
        <p className="mt-3 rounded-xl bg-down-soft px-4 py-3 text-[13px] leading-relaxed text-down">
          {err}
        </p>
      )}

      {/* プラン2つ */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <PlanCard plan="free" current={!isPro} action={null} />
        <PlanCard
          plan="pro"
          current={isPro}
          highlight
          action={
            /*
              解約と支払い方法の変更は、いま入っているプランの側に置く。
              無料の枠の下に「解約」があると、
              「無料に申し込む」ボタンのように見えてしまう
            */
            isPro ? (
              <button
                className="btn btn-quiet w-full justify-center"
                onClick={() => void go('portal')}
                disabled={busy != null}
              >
                {busy === 'portal' ? '開いています…' : '解約・支払い方法の変更'}
              </button>
            ) : (
              <button
                className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
                onClick={() => void go('pro')}
                disabled={busy != null}
              >
                {busy === 'pro' ? '支払い画面へ移動しています…' : 'スタンダードにする'}
              </button>
            )
          }
        />
      </div>

      {/* クレジット */}
      <section className="mt-5 rounded-2xl bg-surface px-5 py-5">
        <h2 className="flex items-center gap-1.5 text-base font-bold">
          <Icon name="plus" size={16} className="text-brand" />
          画像の枠を買い足す
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink2">
          チャートを貼る枚数が上限に近づいたら、必要なぶんだけ買い足せます。
          月額とは別で、1回きりの支払いです。買った枠に期限はありません。
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sunken px-4 py-3">
          <div>
            <p className="text-[15px] font-bold">
              チャート {CREDIT_PACK.images.toLocaleString('ja-JP')} 枚ぶん
            </p>
            <p className="text-[12px] text-ink2">1回きりの支払い</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[17px] font-bold tabular-nums">
              {priceLabel(CREDIT_PACK.yen)}
            </span>
            <button
              className="rounded-xl bg-night px-4 py-2.5 text-[13px] font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
              onClick={() => void go('credit')}
              disabled={busy != null}
            >
              {busy === 'credit' ? '移動しています…' : '買い足す'}
            </button>
          </div>
        </div>
      </section>

      {/* 先に知っておいてほしいこと */}
      <section className="mt-5 rounded-2xl border border-line px-5 py-4">
        <h2 className="text-[13px] font-bold text-ink2">お支払いの前に</h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-[13px] leading-relaxed text-ink2">
          <li>
            無料に戻っても、書いた記録が消えることはありません。
            {FREE_DAYS}日より前が読めなくなるだけで、もう一度お支払いいただければ元どおり見られます。
          </li>
          <li>月額はいつでも解約できます。解約しても、その期間の終わりまでは使えます。</li>
          <li>お支払いは Stripe が扱います。カード番号がこのアプリに残ることはありません。</li>
        </ul>
      </section>
    </div>
  )
}

/** プラン1枚 */
function PlanCard({
  plan,
  current,
  highlight,
  action,
}: {
  plan: 'free' | 'pro'
  current: boolean
  highlight?: boolean
  action: React.ReactNode
}) {
  const p = PLANS[plan]
  return (
    <section
      className={`flex flex-col rounded-2xl px-5 py-5 ${
        highlight ? 'bg-surface ring-2 ring-brand' : 'bg-surface'
      }`}
    >
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold">{p.name}</h2>
        {current && (
          <span className="rounded-md bg-sunken px-1.5 py-0.5 text-[11px] font-bold text-ink2">
            利用中
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[12px] text-ink2">{p.blurb}</p>

      <p className="mt-3">
        <span className="text-[26px] font-bold tabular-nums">{priceLabel(p.yen)}</span>
        {p.yen > 0 && <span className="ml-1 text-[13px] text-ink2">/ 月</span>}
      </p>

      <ul className="mt-4 flex flex-1 flex-col gap-2">
        {p.points.map((t) => (
          <li key={t} className="flex gap-2 text-[13px] leading-relaxed">
            <Icon
              name="check"
              size={15}
              className={`mt-0.5 shrink-0 ${highlight ? 'text-brand' : 'text-ink2'}`}
            />
            <span className={highlight ? 'text-ink' : 'text-ink2'}>{t}</span>
          </li>
        ))}
      </ul>

      {action && <div className="mt-5">{action}</div>}
    </section>
  )
}

/** 使っているぶんの帯 */
function Meter({ used, max }: { used: number; max: number }) {
  const ratio = max > 0 ? Math.min(1, used / max) : 0
  // 残りが少ないほど濃くする。数字を読まなくても、そろそろだと分かる
  const tone = ratio >= 0.9 ? 'bg-down' : ratio >= 0.7 ? 'bg-brand' : 'bg-brand/60'
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-sunken">
      <div
        className={`h-full rounded-full transition-all ${tone}`}
        style={{ width: `${Math.max(ratio * 100, used > 0 ? 2 : 0)}%` }}
      />
    </div>
  )
}
