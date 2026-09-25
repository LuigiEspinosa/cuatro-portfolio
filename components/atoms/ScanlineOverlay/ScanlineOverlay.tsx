import './ScanlineOverlay.scss';

/**
 * The scrim layer (Story 2-28): one flat layer in the contract's scrim role at its raised level,
 * both read in `ScanlineOverlay.scss`, between moving imagery and the text over it
 * (`DESIGN.md:739-748`). It is decorative by absence, so `aria-hidden` is the whole of its
 * accessibility, and the stylesheet gives it `pointer-events: none` so it never takes a click meant
 * for what is beneath or beside it. No prop: the layer has one state, see the stylesheet heading.
 *
 * **Placement.** It covers the positioned box it is placed in, so the parent is the imagery's box,
 * and it belongs only where text overlays moving imagery: never a card ground, a section ground, a
 * vignette or a hover state. No surface consumes it until Story 2-29 places it across the home
 * canvas (`epics.md:3286-3361`), where the sticky header above it makes the guarantee a stacking
 * question rather than a colour one.
 */
const ScanlineOverlay = () => <div className='scanline-overlay' aria-hidden='true' />;

export default ScanlineOverlay;
