// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 新しい版が出ていないか見にいく仕掛け。
 *
 * いちばん大事なのは「開いた少しあとに一度見る」ところ。
 * ホーム画面に置いたアプリは、控えから起こされて古い版のまま立ち上がることがある。
 * ここを飛ばすと「Safari では新しいのに、ホーム画面のアプリだけ古い」が続く。
 */

const checkForUpdate = vi.fn(async () => false)
vi.mock('../../lib/appVersion', () => ({ checkForUpdate: () => checkForUpdate() }))

let useAppUpdate: typeof import('../useAppUpdate').useAppUpdate

beforeEach(async () => {
  // 本番の作りのときだけ動くので、そのつもりにさせる
  vi.stubEnv('PROD', true)
  vi.useFakeTimers()
  checkForUpdate.mockClear()
  checkForUpdate.mockResolvedValue(false)
  vi.resetModules()
  useAppUpdate = (await import('../useAppUpdate')).useAppUpdate
})

afterEach(() => {
  // 前のテストの仕掛けが残っていると、次のテストの合図にも反応してしまう
  cleanup()
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('新しい版を見にいく間隔', () => {
  it('開いた直後には見にいかない（立ち上がりの読み込みと重ねない）', () => {
    renderHook(() => useAppUpdate())
    expect(checkForUpdate).not.toHaveBeenCalled()
    vi.advanceTimersByTime(3000)
    expect(checkForUpdate).not.toHaveBeenCalled()
  })

  it('開いた少しあとに、一度だけ見にいく', async () => {
    renderHook(() => useAppUpdate())
    await vi.advanceTimersByTimeAsync(6000)
    expect(checkForUpdate).toHaveBeenCalledTimes(1)
  })

  it('そのあとは、しばらく見にいかない', async () => {
    renderHook(() => useAppUpdate())
    await vi.advanceTimersByTimeAsync(6000)
    // 戻ってきても、間を空けないうちは繰り返さない
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(1000)
    expect(checkForUpdate).toHaveBeenCalledTimes(1)
  })

  it('画面から離れている間に消えても、置き土産を残さない', async () => {
    const { unmount } = renderHook(() => useAppUpdate())
    unmount()
    await vi.advanceTimersByTimeAsync(60000)
    expect(checkForUpdate).not.toHaveBeenCalled()
  })

  it('見つけたら、知らせる', async () => {
    checkForUpdate.mockResolvedValue(true)
    const { result, rerender } = renderHook(() => useAppUpdate())
    expect(result.current).toBe(false)
    await vi.advanceTimersByTimeAsync(6000)
    rerender()
    expect(result.current).toBe(true)
  })
})
