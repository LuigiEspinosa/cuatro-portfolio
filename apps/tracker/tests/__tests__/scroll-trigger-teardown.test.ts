// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getHooks } from 'vitest/suite'
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

  /* The fix is the wiring, not the helper: `tests/setup.ts` must stop the interval in an `afterAll` of every
   * file. The runner merges the setup file's hooks into the file suite's (wrapped, so compared by effect, not
   * identity), and the other one there is Testing Library's act-environment restore. Dropping the setup line
   * leaves no hook that stops the interval, and this case fails. */
  it('is run by an afterAll hook that tests/setup.ts gives every file', async ({ task }) => {
    vi.useFakeTimers()
    const { ScrollTrigger } = await import('gsap/ScrollTrigger')
    ScrollTrigger.enable()
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 0)
    vi.advanceTimersByTime(300)
    expect(raf, 'the interval runs before the hooks').toHaveBeenCalled()

    for (const hook of getHooks(task.file).afterAll) await hook(task.file)
    raf.mockClear()
    vi.advanceTimersByTime(1000)
    expect(raf, 'no file afterAll hook stopped the interval').not.toHaveBeenCalled()
  })
})
