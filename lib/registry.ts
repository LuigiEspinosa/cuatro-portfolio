/**
 * The Hub's one read of the published App Registry (AD-4, FR-12, FR-35, Story 2.7).
 *
 * `contracts/registry.json` is the estate's only Registry and this is the only module that imports
 * it. The import is static and resolves to the authored file itself, which is the same one
 * `packages/contracts-serve/publish.mjs` copies to `/contracts/registry.json` at build time, so the
 * Hub consumes exactly what it publishes rather than a transform or a private copy. There is no
 * fetch: a build that reached over the network for its own published surface would fail whenever
 * the site it publishes to is down.
 *
 * **Why the shape is asserted rather than inferred.** TypeScript builds a JSON module's type from
 * the literal, so `status` widens to `string` and `live` is structurally absent from the eight
 * entries that do not declare it. The resulting element union is not assignable to `RegistryEntry`
 * in either direction, so a plain annotation is rejected and no honest narrowing exists in the type
 * system alone. The assertion below is what makes `status` a union worth switching on and `live` an
 * optional field worth checking.
 *
 * **What makes the assertion safe.** `ops/registry-schema.mjs` validates this exact file against
 * `contracts/registry.schema.json` on every push, as a blocking gate, so the file matches the
 * schema before a build runs. That leaves one gap the gate cannot see, since it never reads this
 * module: whether the types below still match the schema they claim to mirror. The value lists are
 * exported for that reason and `lib/__tests__/registry.test.ts` compares each one against the
 * schema's own `enum` and `required` arrays, so a fifth status added there fails here rather than
 * silently making this assertion a lie. Nothing validates at run time.
 */
import registryJson from '@/contracts/registry.json';

/** The four-value taxonomy, verbatim from the schema's `status` enum. No synonyms exist. */
export const REGISTRY_STATUSES = ['Live', 'Complete', 'In progress', 'Archived'] as const;
export type RegistryStatus = (typeof REGISTRY_STATUSES)[number];

/** What a Visitor can do with an application before they click (FR-27, AD-13). */
export const DEMO_VALUES = ['demo-account', 'open', 'not-deployed', 'none'] as const;
export type DemoAccess = (typeof DEMO_VALUES)[number];

/** How an application authenticates (AD-12). */
export const IDENTITY_VALUES = ['oidc', 'wallet', 'none'] as const;
export type IdentityMode = (typeof IDENTITY_VALUES)[number];

/** The eight fields the schema requires on every entry. The other four are optional there and here. */
export const REQUIRED_FIELDS = [
  'id',
  'name',
  'description',
  'status',
  'tech',
  'source',
  'demo',
  'identity',
] as const;

/**
 * One Estate application.
 *
 * `demo` and `identity` carry an explicit value including `none`, because absence is never "not
 * applicable". `live` is required when `status` is `Live` and forbidden when `Archived`, which the
 * schema enforces and this type cannot: an optional field is the closest a structural type gets to
 * a conditional one.
 */
export interface RegistryEntry {
  id: string;
  name: string;
  description: string;
  status: RegistryStatus;
  tech: string[];
  source: string;
  demo: DemoAccess;
  identity: IdentityMode;
  live?: string;
  family?: string;
  absorbed_into?: string;
  token_contract?: string;
}

export interface Registry {
  $schema: string;
  contract_version: string;
  applications: RegistryEntry[];
}

const registry = registryJson as Registry;

/** Every entry, in file order. Archived and absorbed applications included: the Registry is the estate. */
export const applications: readonly RegistryEntry[] = registry.applications;

/**
 * The statuses a Visitor sees, which is FR-35's curated subset verbatim: `Live` or `Complete`. The
 * schema says the same at its `status` node. The other two are held in the Registry for link
 * verification and the Estate record, and are not rendered.
 */
export const RENDERED_STATUSES: readonly RegistryStatus[] = ['Live', 'Complete'];

/**
 * The rule that decides what a Visitor sees, taking the list rather than reading the module's own,
 * so it can be exercised against a state the committed file is not in.
 *
 * It is a rule over `status` and nothing else. AD-4 forbids a hand-maintained second list, so
 * flipping an entry to a rendered status must surface it with no other edit, and flipping it away
 * must remove it in the same change. File order is preserved; the Registry's order is the
 * Registry's to decide.
 */
export function selectRendered(entries: readonly RegistryEntry[]): readonly RegistryEntry[] {
  return entries.filter((entry) => RENDERED_STATUSES.includes(entry.status));
}

/** The entries the committed Registry marks rendered. Six as of Contract v1.1.0, all of them `Live`. */
export const renderedApplications: readonly RegistryEntry[] = selectRendered(applications);

/**
 * The origin the Hub itself is served from, declared once for the whole repository.
 *
 * Two readers consume this and there is deliberately no second literal: `app/layout.tsx` builds
 * `metadataBase` from it, and the Suite Directory compares it against each entry's `live` to decide
 * which row carries `You are here` (`EXPERIENCE.md:291`). Written twice, the two would drift the
 * day the Hub moved, and the failure would be a directory that links the visitor to the page they
 * are already on while every test stayed green, because each half would still agree with itself.
 */
export const HUB_ORIGIN = 'https://cuatro.dev';

/** A URL's origin, or `null` for anything `URL` refuses. The Registry's shape is a schema's job. */
const originOf = (url: string): string | null => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

/**
 * Whether `entry` is the application serving `origin`, which is what `You are here` marks.
 *
 * **Compared on origin, never on `id`.** An id match would be a second hand-maintained fact about
 * which entry is the Hub, and it would go on being true after the Hub moved to another hostname.
 * Origin is the thing the sentence actually claims: the reader is already on this application. Move
 * `HUB_ORIGIN` and the mark moves with it, with no other edit.
 *
 * `origin` is a parameter for the reason `selectRendered` takes its list: a rule that takes its
 * input can be exercised against a state the committed file is not in.
 */
export function isCurrentOrigin(entry: RegistryEntry, origin: string = HUB_ORIGIN): boolean {
  if (entry.live === undefined) return false;
  const declared = originOf(origin);
  return declared !== null && originOf(entry.live) === declared;
}

/**
 * Every entry serving `origin`. Normally one, and the plural form exists because it can be more.
 *
 * The Suite Directory marks `You are here` on **every** row `isCurrentOrigin` matches, so two
 * entries declaring one origin is a state the Registry admits and the page already renders: two
 * marked rows. Nothing in `contracts/registry.schema.json` makes `live` unique, and nothing would
 * notice, so the set is exposed rather than collapsed and `lib/__tests__/registry.test.ts` pins the
 * committed Registry at exactly one.
 *
 * **`applications` rather than `renderedApplications`.** The Hub is `Live` today, and an entry
 * flipped to a status the filter holds back would still be the application serving the page the
 * reader is on. Which entry the reader is looking at is not a question about what renders.
 *
 * Both parameters carry defaults for the reason `selectRendered` takes its list at all: a rule that
 * takes its input can be exercised against a state the committed file is not in.
 */
export function hubEntries(
  origin: string = HUB_ORIGIN,
  entries: readonly RegistryEntry[] = applications
): readonly RegistryEntry[] {
  return entries.filter((entry) => isCurrentOrigin(entry, origin));
}

/**
 * The one entry serving `origin`, or `undefined` when the Registry holds none **or more than one**.
 *
 * The Plate mark above the Suite Directory names the Hub and the domain it is served from, and both
 * halves come from here rather than from two literals. It is `isCurrentOrigin` run over the whole
 * Registry rather than a second opinion about which entry is the Hub, so the mark on the premise
 * block and the `You are here` mark on the row below it can never disagree: move `HUB_ORIGIN` and
 * both move together, with no other edit.
 *
 * **Ambiguity is refused rather than resolved by position, and that is the whole reason this is not
 * a `find`.** Taking the first match would put one application's name and domain on the mark while
 * the Directory below marked two rows `You are here`, which is a page contradicting itself with
 * every gate green. Answering nothing is the visible failure: `Premise` draws no mark at all when
 * this is `undefined`, because an identity the Registry does not unambiguously carry is one the
 * block would have to invent. `hubEntries` above is where a caller that wants to see the ambiguity
 * looks at it.
 */
export function hubEntry(
  origin: string = HUB_ORIGIN,
  entries: readonly RegistryEntry[] = applications
): RegistryEntry | undefined {
  const serving = hubEntries(origin, entries);
  return serving.length === 1 ? serving[0] : undefined;
}

/**
 * The six frontend frameworks the estate is built across, in the order the framework band draws
 * them (Story 2-11, FR-4).
 *
 * **A declared editorial classification, and the Registry is the referent for it.** `DESIGN.md:208`
 * states the shape of the claim, six frontend frameworks against five backend languages;
 * `EXPERIENCE.md:79` lists the six in scope; `mockups/key-screens.html:240` renders them in this
 * order. None of those is machine-readable and none of them is a second source of truth: every name
 * here is held against some entry's `tech` by `lib/__tests__/registry.test.ts`, so a name that names
 * nothing the estate actually runs fails there rather than shipping as ornament made of an invented
 * fact, which `EXPERIENCE.md:299-300` forbids outright.
 *
 * **One name resolves through a longer one, and it is named as the single exception it is.**
 * `digital-library` declares the meta-framework it is built with rather than the framework
 * underneath it, so that one name resolves by containment and every other by equality. The test
 * holds the exception as a pair rather than loosening the rule for all six, because plain
 * containment would let a stack value that merely spells a name inside a different product resolve
 * it, and a band naming a framework nothing is built with is the invented fact this list exists to
 * prevent.
 *
 * **Each name is distinct, and that is asserted too.** A repeated name would draw twice in the band
 * and, in the sibling list below, inflate a figure the footer states, while every resolution check
 * went on passing because a duplicate resolves exactly as well as the original.
 *
 * The band is ornament and carries no state (`DESIGN.md:684`). It is not a legend, nothing on the
 * page keys off it, and FR-4 requires the premise beside it to carry without it.
 */
export const ESTATE_FRAMEWORKS = ['Next.js', 'Svelte', 'Vue', 'Angular', 'LiveView', 'React'] as const;

/**
 * The five backend languages, on exactly the same terms as `ESTATE_FRAMEWORKS` above.
 *
 * `DESIGN.md:208` is the source of the count and `EXPERIENCE.md:295` is what consumes it: the
 * footer line states how many there are, spelled from this list's own length rather than typed. Each
 * name is a `tech` value some entry declares verbatim, which the same test holds, so a sixth name
 * appearing here without an application behind it fails rather than inflating the line. So does a
 * repeat of a name already here, which no resolution check could catch: the footer states this
 * list's length, so a duplicate is a language the estate is credited with twice.
 */
export const ESTATE_LANGUAGES = ['TypeScript', 'Elixir', 'Python', 'Go', 'Solidity'] as const;

/**
 * Rendered entries in reading order: every `Live` before every `Complete`, file order within each.
 *
 * The rank comes from `RENDERED_STATUSES`, so the order is the same fact that decides what renders
 * at all rather than a second opinion about it. `Array.prototype.sort` is stable, which is what
 * keeps the Registry's own order intact inside a status: nothing here sorts alphabetically or by
 * date, because the Registry's order is the Registry's to decide (AD-4).
 *
 * A status outside the rendered list sorts last rather than throwing. `selectRendered` has already
 * removed those, and a comparator is the wrong place to discover it has not.
 */
export function orderByStatus(entries: readonly RegistryEntry[]): readonly RegistryEntry[] {
  const rank = (entry: RegistryEntry): number => {
    const at = RENDERED_STATUSES.indexOf(entry.status);
    return at === -1 ? RENDERED_STATUSES.length : at;
  };
  return [...entries].sort((left, right) => rank(left) - rank(right));
}

/** One thing the directory draws: a lone entry, or a family rendered as a group. */
export type DirectoryItem =
  | { readonly kind: 'entry'; readonly entry: RegistryEntry }
  | { readonly kind: 'family'; readonly family: string; readonly members: readonly RegistryEntry[] };

/**
 * The entries as the directory draws them, with each `family` collapsed into one group.
 *
 * A group takes the position of its first member, so `orderByStatus` still decides where the group
 * sits. Members keep the order they arrive in.
 *
 * **Grouping wins over ordering, and that is a decision rather than a side effect.** The two rules
 * can disagree: a `Complete` family member is drawn inside its group, above `Live` entries that
 * come after the group, which is not what "every `Live` precedes every `Complete`" would give on
 * its own. `EXPERIENCE.md:356-358` settles it. The group is "a labelled container holding whichever
 * members pass the FR-35 filter", and its framing line holds regardless of how many render and
 * names no count. A family split across the page by status would not be that container, and the
 * reader's question at the group is which implementations exist, not which shipped first.
 *
 * Nothing in the committed Registry exercises this today, every rendered entry being `Live`. It
 * arrives the day `poketracker-go`, the third `tracker-family` member, changes status, so it is
 * pinned over a fixture rather than left to be discovered then.
 *
 * **A family of one is still a group.** The framing line names no count
 * (`EXPERIENCE.md:292`), so a family that loses a member to a status change needs no other edit; a
 * rule that unwrapped a single member would make the box appear and disappear as the estate moved.
 */
export function groupByFamily(entries: readonly RegistryEntry[]): readonly DirectoryItem[] {
  const drawn = new Set<string>();
  const items: DirectoryItem[] = [];

  for (const entry of entries) {
    if (entry.family === undefined) {
      items.push({ kind: 'entry', entry });
      continue;
    }
    if (drawn.has(entry.family)) continue;
    drawn.add(entry.family);
    items.push({
      kind: 'family',
      family: entry.family,
      members: entries.filter((candidate) => candidate.family === entry.family),
    });
  }

  return items;
}
