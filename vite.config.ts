/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // 画面を触るテスト（フックなど）は、ファイルの先頭で
    // @vitest-environment jsdom を指定して切り替える。
    // 大半は素の関数のテストなので、既定は軽い node のまま
    environment: 'node',
  },
})
