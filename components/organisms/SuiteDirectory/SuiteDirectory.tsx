import {
  groupByFamily,
  isCurrentOrigin,
  orderByStatus,
  renderedApplications,
  type RegistryEntry,
} from '@/lib/registry';
import './SuiteDirectory.scss';

/**
 * The Suite Directory (Story 2-9, FR-11, FR-35).
 *
 * **A server component, and that is load-bearing rather than incidental.** A client component that
 * value-imported the Registry would ship all fourteen entries to a visitor who is shown six, which
 * is what `lib/__tests__/registry.test.ts:621-668` refuses. Rendering on the server satisfies that
 * by construction rather than by a mock, and the directory has no state to justify a boundary:
 * hover and focus are CSS, and the orchestrated entrance belongs to Story 2-12.
 *
 * **Every decision here is a rule over data.** What renders is `selectRendered` (Story 2-7),
 * unchanged. The order, the `You are here` mark and the family grouping are the three exported
 * rules beside it. There is no second list anywhere in this file: flipping an entry's `status` in
 * the Registry surfaces or removes it, and moving `HUB_ORIGIN` moves the mark, with no edit here.
 *
 * DOM order is `EXPERIENCE.md:317-320`: name, status, description, tech, links. That is Daniela's
 * reading order and it is also the grid's source order, so the two cannot disagree.
 */

/** The fragment `/#suite` resolves to. The heading carries it, because focus moves to the heading. */
const HEADING_ID = 'suite';

/** Already the product's own separator in the footer line at `EXPERIENCE.md:295`. */
const TECH_SEPARATOR = ' · ';

/**
 * The live link's text: the bare domain, never "View Live" (`EXPERIENCE.md:289`).
 *
 * The URL is the evidence, so the label is read off the URL rather than written beside it. A `www.`
 * prefix is dropped because it is not part of what the reader is being told; the rest of the host,
 * subdomain included, is exactly the fact.
 */
const bareDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/**
 * A family id read as a name: `tracker-family` is the Tracker Family.
 *
 * Derived rather than looked up, so a family added to the Registry needs no edit here. A map from
 * id to label would be the second list this component exists without.
 */
const familyName = (family: string): string =>
  family
    .split('-')
    .filter((word) => word !== '')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');

/**
 * One entry, drawn as a row.
 *
 * **Exported so the arms the committed Registry cannot reach are testable at the rendering level.**
 * Nothing is `Complete` today, and how the filter treats a `Complete` entry is a different claim
 * from how a row draws one: the first is `selectRendered`'s and is proved over fixtures in
 * `lib/__tests__/registry.test.ts`, the second is this component's and is proved here.
 *
 * This is deliberately the narrow seam. It takes one entry and returns one `<li>`, so it cannot
 * change what `SuiteDirectory` renders; an `entries` prop on the section would make "render
 * something other than the rendered set" structurally reachable, which is what the story's Ask
 * First list refuses.
 */
export function SuiteDirectoryRow({ entry }: { entry: RegistryEntry }) {
  const here = isCurrentOrigin(entry);

  /**
   * The destination, or nothing.
   *
   * **An empty string is not a destination and is checked for rather than trusted.** `live` is
   * optional in the type and only *forbidden* when `Archived`, so `''` is a shape the type admits;
   * rendered, it becomes `href=""`, which reloads the page the reader is already on. That is the
   * worst of the three ways to get a missing link wrong, because it looks like a working link and
   * behaves like a broken one. A presence check on the key alone would let it through.
   */
  const live = entry.live?.trim() ?? '';

  return (
    <li className='suite-directory__row'>
      <h3 className='suite-directory__name'>{entry.name}</h3>

      <p className='suite-directory__status' data-status={entry.status}>
        {/* The 4px square that carries the `Live` / `Complete` distinction structurally
            (`DESIGN.md:298-323`, `:621-624`). Absent on every other value, rather than hidden. */}
        {entry.status === 'Live' && <span className='suite-directory__dot' aria-hidden='true' />}
        {entry.status}
      </p>

      <p className='suite-directory__description'>{entry.description}</p>

      <p className='suite-directory__tech'>{entry.tech.join(TECH_SEPARATOR)}</p>

      <div className='suite-directory__links'>
        {/* `You are here` replaces the live link and nothing else: the entry keeps its Source link,
            which `EXPERIENCE.md:331-332` requires on every entry without exception. An entry with
            no `live` renders no slot at all, never a placeholder or a disabled control. */}
        {here && <span className='suite-directory__here'>You are here</span>}
        {!here && live !== '' && (
          <a className='suite-directory__live' href={live} target='_blank' rel='noopener noreferrer'>
            <span className='suite-directory__rule'>{bareDomain(live)}</span>
          </a>
        )}

        <a
          className='suite-directory__source'
          href={entry.source}
          target='_blank'
          rel='noopener noreferrer'
          aria-label={`Source: ${entry.name}`}
        >
          <span className='suite-directory__rule'>Source</span>
        </a>
      </div>
    </li>
  );
}

export function SuiteDirectory() {
  const entries = orderByStatus(renderedApplications);

  return (
    <section className='suite-directory'>
      <div className='suite-directory__head'>
        {/* `tabIndex={-1}` so `/#suite` moves focus and not only scroll position
            (`EXPERIENCE.md:420`). It is negative, so the heading never becomes a tab stop. */}
        <h2 className='suite-directory__heading' id={HEADING_ID} tabIndex={-1}>
          The Suite
        </h2>
        {/* The real rendered count, never a literal and never a rounded figure. */}
        <p className='suite-directory__count'>{entries.length} running</p>
      </div>

      <ul className='suite-directory__list'>
        {groupByFamily(entries).map((item) =>
          item.kind === 'entry' ? (
            <SuiteDirectoryRow key={item.entry.id} entry={item.entry} />
          ) : (
            <li className='suite-directory__family' key={item.family}>
              <p className='suite-directory__family-name' id={`suite-${item.family}`}>
                {familyName(item.family)}
              </p>
              <p className='suite-directory__family-line'>
                One product family, distinct implementations, deliberately not merged.
              </p>
              {/* A nested `<ul>` with an accessible name, which is A-8 (`EXPERIENCE.md:767`). */}
              <ul className='suite-directory__family-list' aria-labelledby={`suite-${item.family}`}>
                {item.members.map((entry) => (
                  <SuiteDirectoryRow key={entry.id} entry={entry} />
                ))}
              </ul>
            </li>
          )
        )}
      </ul>
    </section>
  );
}
