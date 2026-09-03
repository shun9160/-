import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { isResetRequested, registerServiceWorker, resetServiceWorker } from './lib/pwa'

/*
  困ったときの入口。/?reset=1 で開くと、控えを全部捨ててから開き直す。

  アプリを描く前にここで止める。おかしな控えが原因で画面が出ない状態を
  直すための道なので、その画面を描こうとしては意味がない。
*/
if (isResetRequested()) {
  document.getElementById('root')!.innerHTML =
    '<p style="font-family:system-ui;padding:3rem 1.5rem;text-align:center;color:#6B6A7B">' +
    '読み込み直しています…</p>'
  void resetServiceWorker().then(() => {
    // 合言葉を落として開き直す。残すと、開くたびに毎回やり直しになる
    window.location.replace(window.location.origin + '/')
  })
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )

  // 画面を出してから登録する。起動をこれで遅らせない
  registerServiceWorker()
}
