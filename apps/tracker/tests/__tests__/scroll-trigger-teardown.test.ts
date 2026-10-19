// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { stopScrollTrigger } from '../scroll-trigger-teardown'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('stopScrollTrigger (DW-341)', () => {
  it('stops the sync interval, so no requestAnimationFrame call outlives the file', async () => {
    // Fake timers first, so the interval ScrollTrigger starts when it registers is a fake one.
    vi.useFakeTimers()
    const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
    gsap.registerPlugin(ScrollTrigger)
    // Returning 0 keeps ScrollTrigger's pending-frame id falsy, so every tick would ask for a frame.
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 0)

    vi.advanceTimersByTime(300)
    expect(raf, 'the interval runs before the guard').toHaveBeenCalled()

    await stopScrollTrigger()
    raf.mockClear()
    vi.advanceTimersByTime(1000)
    expect(raf, 'the interval still asks for a frame after the guard').not.toHaveBeenCalled()
  })
})
