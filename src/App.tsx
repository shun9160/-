import { useState } from 'react'
import { useTrades } from './hooks/useTrades'
import Overview from './components/Overview'
import StatsPanel from './components/StatsPanel'
import UploadPanel from './components/UploadPanel'
import TradesTable from './components/TradesTable'
import Diary from './components/Diary'

type Tab = 'dashboard' | 'trades' | 'diary'

export default function App() {
  const { trades, dayNotes, loading, error, configured, demo, reload } = useTrades()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [focusDay, setFocusDay] = useState<string | null>(null)

  function openDay(day: string) {
    setFocusDay(day)
    setTab('diary')
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-6">
      {/* ヘッダ */}
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">FX Trading Journal</h1>
          <p className="text-xs text-gray-500">MT5取引履歴の分析・日記 — 日本時間で記録</p>
        </div>
        <button
          onClick={() => reload()}
          className="btn bg-panel-2 text-gray-300 hover:bg-border"
          title="再読込"
        >
          ⟳ 更新
        </button>
      </header>

      {demo && <DemoNotice />}
      {error && (
        <div className="mb-4 rounded-xl border border-down/40 bg-down/10 p-4 text-sm text-down">
          読み込みエラー: {error}
        </div>
      )}

      {/* ナビ */}
      <nav className="mb-5 flex gap-2">
        {(
          [
            ['dashboard', 'ダッシュボード'],
            ['trades', '取引一覧'],
            ['diary', '日記'],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`chip ${tab === k ? 'chip-on' : 'chip-off'}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-500">読み込み中…</div>
      ) : (
        <>
          {tab === 'dashboard' && (
            <div className="space-y-4">
              <Overview trades={trades} onSelectDay={openDay} />
              <StatsPanel trades={trades} />
              <UploadPanel onChanged={reload} disabled={!configured} />
            </div>
          )}
          {tab === 'trades' && (
            <div className="space-y-4">
              <UploadPanel onChanged={reload} disabled={!configured} />
              <TradesTable trades={trades} onChanged={reload} readOnly={demo} />
            </div>
          )}
          {tab === 'diary' && (
            <Diary
              trades={trades}
              dayNotes={dayNotes}
              onChanged={reload}
              focusDay={focusDay}
              readOnly={demo}
            />
          )}
        </>
      )}

      <footer className="mt-12 text-center text-xs text-gray-700">
        時刻はドバイ時間 (UTC+4) で取り込み、日本時間 (UTC+9) に変換して記録しています。
      </footer>
    </div>
  )
}

function DemoNotice() {
  return (
    <div className="mb-4 rounded-xl border border-yellow-600/40 bg-yellow-500/10 p-4 text-sm">
      <div className="font-semibold text-yellow-400">🧪 デモモード（仮データ表示中）</div>
      <p className="mt-1 text-gray-300">
        Supabase が未設定のため、サンプル取引でUIを表示しています（編集・保存は無効）。
        実データを使うには <code className="rounded bg-panel-2 px-1">VITE_SUPABASE_URL</code> と{' '}
        <code className="rounded bg-panel-2 px-1">VITE_SUPABASE_ANON_KEY</code> を設定してください
        （ローカルは <code className="rounded bg-panel-2 px-1">.env</code>、Netlify は環境変数）。手順は README 参照。
      </p>
    </div>
  )
}
