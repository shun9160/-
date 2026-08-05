/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 面 — 白基調。ニュートラルはアクセント(紫)寄りにわずかに振っている
        page: '#FAFAFC',
        surface: '#FFFFFF',
        sunken: '#F4F4F8',
        line: '#E9E9F0',

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
        card: '0 1px 2px rgba(24, 23, 31, 0.04)',
        raised: '0 4px 16px rgba(24, 23, 31, 0.08)',
        nav: '0 -1px 0 #E9E9F0',
      },
      borderRadius: {
        xl2: '1rem',
      },
    },
  },
  plugins: [],
}
