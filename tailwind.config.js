/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  future: {
    // 指で押したあと hover の色が残らないようにする。
    // これが無いと、タップした升目だけ灰色に塗られたままになる
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      colors: {
        // 面 — 「浮いたカード」ではなく「面の切り替え」で階層を作る。
        // 下地(page) → 白い面(surface) → 一段沈んだ面(sunken) の3段だけ。
        // 影ではなく、色の差と細い線で境目を出す。
        page: '#F1F0F6',
        surface: '#FFFFFF',
        sunken: '#F4F3F9',
        line: '#E5E4EE',

        // 濃色の面。下のタブと日記で使う。ここだけが「暗い面」
        night: '#16151F',
        night2: '#242231',

        // 文字
        ink: '#18171F',
        ink2: '#6B6A7B',
        ink3: '#9C9BAA',

        // ブランド(紫)
        brand: '#6D4AFF',
        brand2: '#8B6DFF',
        'brand-soft': '#F1EDFF',

        // 損益 — 検証済み(色覚多様性ΔE 11.6 / コントラスト合格)。
        // 色だけに頼らず、数値には必ず +/- 記号を併記すること。
        up: '#16A34A',
        'up-soft': '#E8F6ED',
        down: '#B42318',
        'down-soft': '#FCECEA',

        // カレンダーの升目用。下地(#F1F0F6)の上でも「塗ってある」と
        // 分かる濃さにしてある。soft のままだと下地とほぼ同じ明るさで、
        // 塗りがあることに気づけなかった
        'up-fill': '#D3EFDD',
        'down-fill': '#FBD9D3',
        // 塗りの上に載せる数字。up(#16A34A) だと 2.69 しか出ないので、
        // 同じ緑のまま暗くして 5.42 にしてある
        'up-deep': '#0E6B31',

        // 取引の評価に使う星。白地でも見えるよう濃いめ
        amber: '#D97706',
        'amber-soft': '#FDF0DF',
      },
      fontFamily: {
        // 英数字は IBM Plex Sans（技術系の実直な書体）、日本語は各OSの標準に任せる。
        // 数字の形が揃っていて、金額を並べたときに読み違えにくい。
        sans: [
          '"IBM Plex Sans Variable"',
          '"IBM Plex Sans"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Hiragino Sans"',
          '"Hiragino Kaku Gothic ProN"',
          '"Yu Gothic Medium"',
          '"Noto Sans JP"',
          '"Segoe UI"',
          'sans-serif',
        ],
        display: ['"IBM Plex Sans Variable"', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // 数字を大きく見せるための追加ステップ
        stat: ['2rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        hero: ['2.75rem', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
      },
      boxShadow: {
        // 影はほぼ使わない。境目は線と面の色で出す。
        // ここに残しているのは、画面の上に浮かせるものだけ
        card: 'none',
        raised: '0 6px 24px rgba(16, 21, 31, 0.14)',
        nav: '0 -1px 0 #E5E4EE',
      },
      borderRadius: {
        xl2: '1rem',
      },
    },
  },
  plugins: [],
}
