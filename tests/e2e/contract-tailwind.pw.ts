import { test, expect, type Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { RENDERED_VIEWPORT, computedStyleValue } from './harness';

/**
 * The Tailwind adapter, verified where it is actually consumed (Story 1-13).
 *
 * The failure this exists to catch is a mapping that parses, publishes, and
 * mints nothing. Every string assertion over `contracts/tailwind.css` passes
 * such a mapping, which is why the acceptance for this story is a real Tailwind
 * v4 compile loaded in the pinned browser image and not a unit test.
 *
 * Four checks:
 *
 *  1. **Every mapping mints a working utility.** The compiled stylesheet is
 *     searched for each utility's selector, and each utility's computed value is
 *     compared against a control element that declares the same contract token
 *     directly. The comparison is therefore the browser's own resolution of the
 *     same value on both sides, never an expected string a typo could be copied
 *     into. The number of probed mappings is asserted equal to the number in
 *     `theme-map.json`, so the check cannot pass over nothing, and a namespace
 *     with no probe rule fails the spec rather than being skipped.
 *  2. **The premise.** The same fixture compiled against `tailwindcss` plus
 *     `tokens.css` with no `@theme` block mints none of them. That is
 *     `DESIGN.md:1058-1066`, and without it a pass above would prove nothing.
 *  3. **The faces load.** The adapter imports `fonts.css` precisely so the
 *     cluster gets faces and not just family names, so every woff2 the compiled
 *     output requests must answer 200 and `document.fonts.check` must report
 *     each family available. `RESTYLE-SPEC.md:648` (F-2) is why the check is not
 *     a computed `font-family` read: a stack reads identically when every woff2
 *     has 404'd.
 *  4. **The placement rule is load-bearing.** The pinned CLI copies the `url()`s
 *     out of `fonts.css` through the `@import` unrebased, so the compiled
 *     stylesheet has to land in the vendored folder beside them. The same build
 *     written one directory up is loaded here and observed 404ing, which is what
 *     makes the rule in `ops/tailwind-adapter.md` an observation rather than an
 *     assumption.
 *
 * **Why the scratch tree is under the repository and not under `tmpdir()`.**
 * `tests/e2e/contract-fonts.pw.ts` builds its tree in the system temp directory,
 * and this one deliberately does not: the Tailwind CLI resolves
 * `@import "tailwindcss"` by walking up from the input file looking for
 * `node_modules`, so an input under `tmpdir()` cannot find the pinned compiler.
 * The tree is removed in teardown, so nothing reaches the closing commit.
 */

// `__dirname` rather than `import.meta.url`: Playwright transpiles a spec to
// CommonJS, and the repository declares no `"type": "module"`, so `import.meta`
// is a syntax error at run time here even though TypeScript accepts it.
const REPO_ROOT = resolve(__dirname, '..', '..');
const CONTRACTS = join(REPO_ROOT, 'contracts');

interface ThemeMap {
  sections: { title: string; entries: { key: string; token: string }[] }[];
}

const THEME_MAP = JSON.parse(
  readFileSync(join(REPO_ROOT, 'packages', 'tokens', 'theme-map.json'), 'utf8')
) as ThemeMap;

const FACES = JSON.parse(readFileSync(join(REPO_ROOT, 'packages', 'fonts', 'faces.json'), 'utf8')) as {
  faces: { family: string; file: string }[];
};

/**
 * One probe rule per Tailwind namespace the adapter mints into: which utility
 * carries the theme key, and which CSS property that utility is supposed to set.
 *
 * Ordered, and `--font-weight-` sits above `--font-` deliberately: the second is
 * a prefix of the first, and matching in the other order would probe
 * `--font-weight-bold` as a font family and pass over a broken weight mapping.
 */
const PROBE_RULES: { namespace: string; utility: (suffix: string) => string; property: string }[] = [
  { namespace: '--font-weight-', utility: (suffix) => `font-${suffix}`, property: 'font-weight' },
  { namespace: '--color-', utility: (suffix) => `bg-${suffix}`, property: 'background-color' },
  { namespace: '--font-', utility: (suffix) => `font-${suffix}`, property: 'font-family' },
  { namespace: '--text-', utility: (suffix) => `text-${suffix}`, property: 'font-size' },
  { namespace: '--tracking-', utility: (suffix) => `tracking-${suffix}`, property: 'letter-spacing' },
  { namespace: '--leading-', utility: (suffix) => `leading-${suffix}`, property: 'line-height' },
  { namespace: '--spacing-', utility: (suffix) => `p-${suffix}`, property: 'padding' },
  { namespace: '--radius-', utility: (suffix) => `rounded-${suffix}`, property: 'border-radius' },
  { namespace: '--container-', utility: (suffix) => `max-w-${suffix}`, property: 'max-width' },
];

interface Probe {
  key: string;
  token: string;
  utility: string;
  property: string;
}

const probes: Probe[] = THEME_MAP.sections
  .flatMap((section) => section.entries)
  .map((entry) => {
    const rule = PROBE_RULES.find((candidate) => entry.key.startsWith(candidate.namespace));
    if (!rule) {
      // A namespace with no probe rule is a hole in this check, not a mapping to
      // wave through: it would leave a published mapping nothing ever loaded.
      throw new Error(
        `contract-tailwind: the theme key ${entry.key} in packages/tokens/theme-map.json is in a ` +
          `namespace this spec has no probe rule for, so it would be published unverified. Add a ` +
          `rule to PROBE_RULES naming the utility and the property it sets.`
      );
    }
    return {
      key: entry.key,
      token: entry.token,
      utility: rule.utility(entry.key.slice(rule.namespace.length)),
      property: rule.property,
    };
  });

/** `contracts/` copied five directories deep, under AD-14's fixed folder name. */
const VENDORED_AT = ['assets', 'static', 'vendor', 'third-party', 'design', 'cuatro-contracts'];

const MIME: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const escapeForRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The body of the compiled rule for `utility`, or null when there is none. */
const ruleBody = (compiled: string, utility: string): string | null =>
  new RegExp(`(?:^|[\\s,])\\.${escapeForRegExp(utility)}\\s*\\{([^}]*)\\}`, 'm').exec(compiled)?.[1] ?? null;

/** Whether the compiled stylesheet declares a rule for `utility`. */
const mints = (compiled: string, utility: string): boolean =>
  new RegExp(`(^|[\\s,])\\.${escapeForRegExp(utility)}\\s*\\{`, 'm').test(compiled);

/**
 * The probed utility names that stock Tailwind v4 already ships, observed
 * 2026-08-25 against 4.3.3 by compiling the same fixture with no `@theme` block
 * at all. Pinned rather than derived, because it is the one list in this file
 * that a Tailwind version bump can legitimately move, and moving it should be a
 * reviewed line in a diff rather than a silently smaller negative control.
 *
 * Their presence is not a hole in the premise. Tailwind ships the *name* with
 * its own default value; what the adapter does is bind the name to a contract
 * token, and the assertion below is that no rule in a themeless build reads one.
 */
const SHIPPED_BY_TAILWIND = [
  'font-black',
  'font-bold',
  'font-light',
  'font-medium',
  'font-mono',
  'font-sans',
  'rounded-none',
  'text-2xl',
  'text-base',
  'text-lg',
  'text-sm',
  'text-xl',
  'text-xs',
];

/**
 * The pinned CLI, resolved through Node rather than through a shell, so the same
 * line works on the development host and inside the Playwright container and
 * cannot pick up a different Tailwind from a global install.
 */
const tailwindCli = (): string => {
  const manifestPath = require.resolve('@tailwindcss/cli/package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { bin: Record<string, string> };
  return join(dirname(manifestPath), manifest.bin.tailwindcss);
};

const compile = (input: string, output: string): void => {
  const result = spawnSync(process.execPath, [tailwindCli(), '--input', input, '--output', output], {
    encoding: 'utf8',
    timeout: 120_000,
  });
  if (result.status !== 0) {
    throw new Error(
      `contract-tailwind: the pinned Tailwind CLI exited ${result.status} compiling ${input}\n` +
        `${result.stdout ?? ''}\n${result.stderr ?? ''}`
    );
  }
  if (!existsSync(output)) {
    throw new Error(`contract-tailwind: the pinned Tailwind CLI exited 0 but wrote nothing to ${output}`);
  }
};

interface Tree {
  root: string;
  vendored: string;
  compiled: string;
  withoutTheme: string;
}

const buildTree = (): Tree => {
  // Under the repository, not under `tmpdir()`. See the file comment.
  const root = mkdtempSync(join(REPO_ROOT, '.cuatro-tailwind-probe-'));
  const vendored = join(root, ...VENDORED_AT);
  mkdirSync(dirname(vendored), { recursive: true });
  cpSync(CONTRACTS, vendored, { recursive: true });

  const href = VENDORED_AT.join('/');

  // Every probe carries text, because a face with nothing set in it is never
  // requested and `document.fonts.check` would then report it unavailable for a
  // reason that has nothing to do with the contract.
  const rows = probes
    .map(
      (probe) => `
    <div class="row">
      <span data-probe="${probe.key}" class="${probe.utility}">Aa</span>
      <span data-control="${probe.key}" style="${probe.property}: var(${probe.token})">Aa</span>
    </div>`
    )
    .join('\n');

  // The probe and its control differ in exactly one thing: the probe wears the
  // utility and the control declares the token itself. Everything else that
  // could move a computed value, the font the `ch` unit resolves against
  // included, is inherited identically by both.
  //
  // Nothing in the fixture's own stylesheet declares `font-size` or
  // `line-height` on the probe elements, and that is not tidiness. Tailwind
  // emits its utilities inside `@layer utilities`, and an unlayered author rule
  // beats every layered one whatever its specificity, so a
  // `.row span { font-size: 16px }` here would silently win over every `.text-*`
  // utility and the whole type scale would read 16px against a working adapter
  // and a broken one alike. Observed doing exactly that on 2026-08-25 before
  // this was moved. The two properties are set on `body` instead, where they
  // reach the probes by inheritance, and inheritance loses to any declaration on
  // the element itself.
  const fixture = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>contract tailwind</title>
<link rel="stylesheet" href="STYLESHEET">
<style>
  html, body { margin: 0; padding: 0; background: #fff; }
  body { width: ${RENDERED_VIEWPORT.width}px; font-size: 16px; line-height: normal; }
  .row span { display: inline-block; }
</style>
</head>
<body>
${rows}
</body>
</html>
`;

  const page = (stylesheet: string) => fixture.replace('STYLESHEET', stylesheet);

  writeFileSync(join(root, 'fixture.html'), page(`${href}/compiled.css`));

  // The consumer's own entry point: it imports the vendored adapter and nothing
  // else, which is exactly what `DESIGN.md:1056` tells a Tailwind Satellite to do.
  writeFileSync(join(root, 'consumer.css'), `@import "./${href}/tailwind.css";\n@source "./fixture.html";\n`);

  // The premise, as a compile: Tailwind plus a plain `:root` file of custom
  // properties, with no `@theme` block anywhere.
  writeFileSync(
    join(root, 'consumer-no-theme.css'),
    `@import "tailwindcss";\n@import "./${href}/tokens.css";\n@source "./fixture.html";\n`
  );

  const compiled = join(vendored, 'compiled.css');
  const withoutTheme = join(vendored, 'compiled-no-theme.css');
  compile(join(root, 'consumer.css'), compiled);
  compile(join(root, 'consumer-no-theme.css'), withoutTheme);

  // The same compile written one directory above the vendored folder. Its
  // `@font-face` rules carry the identical `./fonts/...` urls, which is the
  // point: they are relative to wherever the compiled file lands.
  compile(join(root, 'consumer.css'), join(root, 'misplaced.css'));

  writeFileSync(join(root, 'no-theme.html'), page(`${href}/compiled-no-theme.css`));
  writeFileSync(join(root, 'misplaced.html'), page('misplaced.css'));

  return { root, vendored, compiled, withoutTheme };
};

const serve = (root: string): Promise<Server> =>
  new Promise((done) => {
    const server = createServer((request, response) => {
      const requested = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
      const target = normalize(join(root, requested === '/' ? '/fixture.html' : requested));
      if (!target.startsWith(root + sep) || !existsSync(target) || statSync(target).isDirectory()) {
        response.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
        return;
      }
      response.writeHead(200, { 'content-type': MIME[extname(target)] ?? 'application/octet-stream' });
      response.end(readFileSync(target));
    });
    server.listen(0, '127.0.0.1', () => done(server));
  });

const readPairs = (page: Page, wanted: { key: string; property: string }[]) =>
  page.evaluate(
    (entries) =>
      Object.fromEntries(
        entries.map(({ key, property }) => {
          const probe = document.querySelector(`[data-probe="${key}"]`);
          const control = document.querySelector(`[data-control="${key}"]`);
          if (!probe || !control) throw new Error(`the fixture carries no probe pair for ${key}`);
          return [
            key,
            {
              probe: window.getComputedStyle(probe).getPropertyValue(property).trim(),
              control: window.getComputedStyle(control).getPropertyValue(property).trim(),
            },
          ];
        })
      ),
    wanted
  );

const woff2Statuses = (page: Page): Map<string, number> => {
  const statuses = new Map<string, number>();
  page.on('response', (response) => {
    if (response.url().endsWith('.woff2')) statuses.set(response.url(), response.status());
  });
  return statuses;
};

const familiesAvailable = (page: Page) =>
  page.evaluate(
    (families) => Object.fromEntries(families.map((family) => [family, document.fonts.check(`16px "${family}"`)])),
    FACES.faces.map((face) => face.family)
  );

let tree: Tree;
let server: Server;
let origin: string;

test.beforeAll(async () => {
  tree = buildTree();
  server = await serve(tree.root);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('the scratch server did not report a port');
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((done) => server.close(() => done()));
  rmSync(tree.root, { recursive: true, force: true });
});

test('every mapping in theme-map.json mints a utility that resolves to the same value as its token', async ({
  page,
}) => {
  const declared = THEME_MAP.sections.reduce((total, section) => total + section.entries.length, 0);
  expect(probes.length, 'the probe list and the theme map disagree, so this test would cover less than it claims').toBe(
    declared
  );
  expect(declared, 'the theme map declares no mappings, so this test would pass over nothing').toBeGreaterThan(0);

  const compiled = readFileSync(tree.compiled, 'utf8');
  const unminted = probes.filter((probe) => !mints(compiled, probe.utility));
  expect(
    unminted.map((probe) => `${probe.key} -> .${probe.utility}`),
    'the compiled Tailwind build declares no rule for these utilities, so the mapping mints nothing'
  ).toEqual([]);

  const response = await page.goto(`${origin}/`, { waitUntil: 'load' });
  expect(response?.status(), 'the fixture page did not answer 200').toBe(200);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));

  const pairs = await readPairs(page, probes);
  const report: string[] = [];
  const mismatched: string[] = [];
  for (const probe of probes) {
    const pair = pairs[probe.key];
    report.push(`${probe.key} -> .${probe.utility} { ${probe.property} } = ${pair.probe}`);
    if (pair.probe !== pair.control || pair.probe === '') {
      mismatched.push(
        `${probe.key}: .${probe.utility} computed ${probe.property} "${pair.probe}", ` +
          `while var(${probe.token}) declared directly computed "${pair.control}"`
      );
    }
  }
  console.log(`contract-tailwind minted utilities (${probes.length}):\n${report.join('\n')}`);

  expect(mismatched, 'a minted utility did not resolve to the token it maps').toEqual([]);

  // `computedStyleValue` from the Story 1-10 harness, on the same page, so the
  // harness's own failure behaviour covers at least one read here too.
  const accent = await computedStyleValue(page, '[data-probe="--color-accent"]', 'background-color');
  expect(accent).not.toBe('rgba(0, 0, 0, 0)');
});

test('the same fixture with no @theme block binds not one utility to the contract', async ({ page }) => {
  const withoutTheme = readFileSync(tree.withoutTheme, 'utf8');
  const present = probes.filter((probe) => mints(withoutTheme, probe.utility));
  const absent = probes.filter((probe) => !mints(withoutTheme, probe.utility));

  console.log(
    `contract-tailwind negative control: ${probes.length} utilities probed against a build of ` +
      `tailwindcss plus tokens.css with no @theme block. ${absent.length} do not exist at all; ` +
      `${present.length} exist as stock Tailwind utilities carrying Tailwind's own values:\n` +
      present.map((probe) => `.${probe.utility} { ${ruleBody(withoutTheme, probe.utility)?.trim()} }`).join('\n')
  );

  // The premise `DESIGN.md:1058-1066` rests on: a plain external file defining
  // custom properties under `:root` generates zero utility classes.
  expect(
    present.map((probe) => probe.utility).sort(),
    'the set of probed names stock Tailwind already ships has changed, which is a Tailwind version ' +
      'move to review rather than noise to absorb'
  ).toEqual([...SHIPPED_BY_TAILWIND].sort());
  expect(absent.length, 'every probed utility already existed, so this control would prove nothing').toBeGreaterThan(0);

  // And the part that is the actual claim: without the `@theme` block, not one
  // rule anywhere in the compiled output reads a contract token. The names stock
  // Tailwind ships carry Tailwind's own values, not ours.
  for (const probe of present) {
    expect(
      ruleBody(withoutTheme, probe.utility),
      `.${probe.utility} read var(${probe.token}) with no @theme block anywhere`
    ).not.toContain(`var(${probe.token})`);
  }

  const response = await page.goto(`${origin}/no-theme.html`, { waitUntil: 'load' });
  expect(response?.status()).toBe(200);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));

  // Read in the browser as well as in the text, on the colour rows, because
  // `background-color` has an unambiguous unset value and a token colour can
  // never equal it.
  const colours = probes.filter((probe) => probe.key.startsWith('--color-'));
  expect(colours.length, 'no colour mapping was probed').toBeGreaterThan(0);
  const pairs = await readPairs(page, colours);
  for (const probe of colours) {
    expect(pairs[probe.key].probe, `.${probe.utility} painted a background without any @theme block`).toBe(
      'rgba(0, 0, 0, 0)'
    );
    expect(pairs[probe.key].control, `var(${probe.token}) did not resolve, so the control measured nothing`).not.toBe(
      'rgba(0, 0, 0, 0)'
    );
  }
});

test('every face the adapter pulls in answers 200 and is available to the document', async ({ page }) => {
  const statuses = woff2Statuses(page);

  const response = await page.goto(`${origin}/`, { waitUntil: 'load' });
  expect(response?.status()).toBe(200);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));

  for (const face of FACES.faces) {
    const url = `${origin}/${VENDORED_AT.join('/')}/fonts/${face.file}`;
    expect(statuses.get(url), `${face.family}: ${url} did not answer HTTP 200`).toBe(200);
  }

  const available = await familiesAvailable(page);
  for (const face of FACES.faces) {
    // F-2: a computed `font-family` read passes identically when every woff2 has
    // 404'd, so availability is the check.
    expect(available[face.family], `${face.family} is not available to the document`).toBe(true);
  }
});

test('the identical build placed outside the vendored folder cannot resolve a single face', async ({ page }) => {
  const statuses = woff2Statuses(page);

  const response = await page.goto(`${origin}/misplaced.html`, { waitUntil: 'load' });
  expect(response?.status()).toBe(200);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));

  // The rule in `ops/tailwind-adapter.md` is an observation, and this is the
  // observation: the pinned CLI copies `./fonts/...` out of `fonts.css` through
  // the `@import` unrebased, so the compiled file must land beside them.
  const observed = [...statuses.entries()].map(([url, status]) => `${status} ${url}`);
  console.log(`contract-tailwind misplaced build:\n${observed.join('\n') || 'no woff2 was requested'}`);
  expect(
    observed.filter((line) => line.startsWith('200')),
    'a compiled build one directory above the vendored folder still resolved a face, so the ' +
      'placement rule the record states is not the rule that holds'
  ).toEqual([]);

  const available = await familiesAvailable(page);
  for (const face of FACES.faces) {
    expect(available[face.family], `${face.family} loaded from a misplaced build`).toBe(false);
  }
});
