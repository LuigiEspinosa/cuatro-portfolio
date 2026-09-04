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
