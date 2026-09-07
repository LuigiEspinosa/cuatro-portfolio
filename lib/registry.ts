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
