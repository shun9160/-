import Icon from '../Icon'
import type { IconName } from '../Icon'
import CharacterFigure from './CharacterFigure'
import { DISCLAIMER, SCORING_NOTE, STATUS_LABELS } from '../../lib/diagnosis/messages'
import { TYPES, TYPE_IDS } from '../../lib/diagnosis/types'
import type { DiagnosisResult, TypeId } from '../../lib/diagnosis/types'
import { fmtJst } from '../../lib/timezone'

interface Props {
  result: DiagnosisResult
  createdAt?: string
  recheck?: { suggested: boolean; reasons: string[] } | null
  busy: boolean
  onRetake: () => void
  onRecalc: () => void
  onToggleAction: (actionId: string, completed: boolean) => void
  onTiebreak: (type: TypeId) => void
}

export default function ResultView({
  result,
  createdAt,
  recheck,
  busy,
  onRetake,
  onRecalc,
  onToggleAction,
  onTiebreak,
}: Props) {
  const def = TYPES[result.primaryType]
  const sub = result.secondaryType ? TYPES[result.secondaryType] : null

  return (
    <div className="flex flex-col gap-4">
      {/* 1〜4: キャラクター・タイプ名・コピー・信頼度 */}
      <section className="card overflow-hidden">
        <div
          className="flex flex-col items-center gap-4 px-5 py-6 text-center sm:flex-row sm:text-left"
          style={{ background: `linear-gradient(135deg, ${def.color}14, transparent 70%)` }}
        >
          <CharacterFigure
            characterId={def.characterId}
            state={result.character.state}
            color={def.color}
            name={def.nameJa}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold tracking-[0.2em] text-ink3">YOUR TRADER TYPE</p>
            <h2 className="mt-1 flex items-center justify-center gap-2 text-3xl font-bold sm:justify-start"
                style={{ color: def.color }}>
              <Icon name={def.icon as IconName} size={26} />
              {result.primaryType}
            </h2>
            <p className="text-sm font-semibold text-ink2">
              {def.nameJa}・{def.category}
            </p>
            <p className="mt-2 text-base font-semibold">「{def.copy}」</p>
            {sub && (
              <p className="mt-2 text-xs text-ink2">
                {result.display === 'hybrid' ? '同じくらい強い傾向' : 'サブ傾向'}：
                <span className="font-bold" style={{ color: sub.color }}>
                  {result.secondaryType}
                </span>
                （{sub.category}）
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line px-5 py-3 text-xs text-ink2">
          <span className="font-bold text-ink">信頼度 {result.confidence}%</span>
          <span>{result.confidenceLabel}</span>
          <span className="text-ink3">{STATUS_LABELS[result.status]}</span>
          {createdAt && <span className="text-ink3">{fmtJst(createdAt, 'yyyy/MM/dd HH:mm')}</span>}
        </div>
        <span className="block h-1.5 w-full bg-sunken">
          <span
            className="block h-full"
            style={{ width: `${result.confidence}%`, background: def.color }}
          />
        </span>
      </section>

      {result.needsTiebreak && (
        <section className="card border-brand/40 p-4">
          <h3 className="text-sm font-bold">もう1問だけ教えてください</h3>
          <p className="mt-1 text-xs text-ink2">
            いまの回答と記録では、上位が並んでいて決めきれませんでした。近いほうを選んでください。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[result.primaryType, result.secondaryType]
              .filter((x): x is TypeId => Boolean(x))
              .map((id) => (
                <button
                  key={id}
                  className="btn btn-ghost border border-line"
                  disabled={busy}
                  onClick={() => onTiebreak(id)}
                >
                  {TYPES[id].nameJa}（{TYPES[id].category}）
                </button>
              ))}
          </div>
        </section>
      )}

      {/* キャラクターの言葉 */}
      <p className="card border-l-4 px-4 py-3 text-sm" style={{ borderLeftColor: def.color }}>
        {result.character.message}
      </p>

      {/* 5・6: 強みと注意点 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ListCard title="強み" icon="star" tone="up" items={result.strengths} />
        <ListCard title="気をつけたいこと" icon="info" tone="amber" items={result.cautions} />
      </div>

      {/* 7: 6タイプの比較 */}
      <section className="card p-4">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h3 className="text-base font-bold">6タイプのスコア</h3>
          <span className="text-xs text-ink3">0〜100</span>
        </div>
        <ul className="flex flex-col gap-2">
          {[...TYPE_IDS]
            .sort((a, b) => result.scores[b] - result.scores[a])
            .map((id) => {
              const t = TYPES[id]
              const on = id === result.primaryType
              return (
                <li key={id} className="flex items-center gap-2.5">
                  <span className={`w-14 shrink-0 text-xs ${on ? 'font-bold' : 'text-ink2'}`}>
                    {id}
                  </span>
                  <span className="relative h-5 flex-1 overflow-hidden rounded-md bg-sunken">
                    <span
                      className="absolute inset-y-0 left-0 rounded-md"
                      style={{
                        width: `${Math.max(2, result.scores[id])}%`,
                        background: t.color,
                        opacity: on ? 1 : 0.45,
                      }}
                    />
                  </span>
                  <span className="w-9 shrink-0 text-right text-xs font-bold tabular-nums">
                    {Math.round(result.scores[id])}
                  </span>
                </li>
              )
            })}
        </ul>
        <p className="mt-3 text-[11px] text-ink3">{SCORING_NOTE}</p>
      </section>

      {/* 8: 判定根拠 */}
      <section className="card overflow-hidden">
        <div className="px-4 pb-2 pt-4">
          <h3 className="text-base font-bold">なぜこのタイプになったのか</h3>
          <p className="text-xs text-ink3">回答と、記録した取引から見えたことです</p>
        </div>
        <ul>
          {result.evidence.map((e) => (
            <li
              key={`${e.impactType}-${e.key}`}
              className="flex items-center gap-3 border-t border-line px-4 py-2.5"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                  e.impact === 'positive'
                    ? 'bg-up-soft text-up'
                    : e.impact === 'warning'
                      ? 'bg-amber-soft text-amber'
                      : 'bg-sunken text-ink3'
                }`}
              >
                <Icon name={e.impact === 'warning' ? 'info' : 'check'} size={13} />
              </span>
              <span className="min-w-0 flex-1 text-sm text-ink2">{e.label}</span>
              <span className="shrink-0 text-sm font-bold tabular-nums">{e.value}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 9: 改善アクション */}
      {result.recommendedActions.length > 0 && (
        <section className="card overflow-hidden">
          <div className="px-4 pb-2 pt-4">
            <h3 className="text-base font-bold">次にやってみること</h3>
            <p className="text-xs text-ink3">記録のしかたを整えるための提案です</p>
          </div>
          <ul>
            {result.recommendedActions.map((a) => (
              <li key={a.id} className="border-t border-line px-4 py-3">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={a.completed}
                    disabled={busy}
                    onChange={(e) => onToggleAction(a.id, e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#6D4AFF]"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm font-semibold ${
                        a.completed ? 'text-ink3 line-through' : ''
                      }`}
                    >
                      {a.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink2">{a.description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 10: 再診断 */}
      <section className="card p-4">
        <h3 className="text-base font-bold">診断をやり直す</h3>
        {recheck?.suggested ? (
          <ul className="mt-1.5 flex flex-col gap-1">
            {recheck.reasons.map((r) => (
              <li key={r} className="text-xs text-ink2">
                ・{r}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-ink2">
            取引が20件増えたときや、前回から30日たったときにやり直すと、変化が見えます。
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={onRetake} disabled={busy}>
            <Icon name="refresh" size={16} />
            24問に答え直す
          </button>
          <button className="btn btn-ghost border border-line" onClick={onRecalc} disabled={busy}>
            前回の回答のまま、記録だけで計算し直す
          </button>
        </div>
      </section>

      <p className="text-[11px] leading-relaxed text-ink3">{DISCLAIMER}</p>
    </div>
  )
}

function ListCard({
  title,
  icon,
  tone,
  items,
}: {
  title: string
  icon: IconName
  tone: 'up' | 'amber'
  items: string[]
}) {
  return (
    <section className="card p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-md ${
            tone === 'up' ? 'bg-up-soft text-up' : 'bg-amber-soft text-amber'
          }`}
        >
          <Icon name={icon} size={13} />
        </span>
        {title}
      </h3>
      <ul className="mt-2.5 flex flex-col gap-1.5">
        {items.map((s) => (
          <li key={s} className="text-sm text-ink2">
            ・{s}
          </li>
        ))}
      </ul>
    </section>
  )
}
