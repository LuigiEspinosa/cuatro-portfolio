/* gsap's ScrollTrigger starts `setInterval(_sync, 250)` when it registers in a window, and `_sync` calls the
 * global `requestAnimationFrame`. jsdom's teardown deletes that global while the interval keeps ticking, so a
 * tick landing before the worker exits throws an unhandled ReferenceError and fails the run (DW-341, `ci.yml`
 * runs 38399622554 and 39026807811). `disable()` clears the interval, and throws on a plugin never
 * registered, so the guard registers first: idempotent where `EraGroundTint` already did, and stopped at once
 * where nothing did. Without a window registering cannot enable it, and `disable()` would throw there too, so
 * the node-environment files return first. */
export async function stopScrollTrigger(): Promise<void> {
  if (typeof window === 'undefined') return
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
  gsap.registerPlugin(ScrollTrigger)
  ScrollTrigger.disable()
}
