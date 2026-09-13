// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BudgetError,
  FINGERPRINTS,
  FONT_BUDGET_BYTES,
  HTML_AND_CSS_BUDGET_BYTES,
  KB,
  NARRATIVE_ESTIMATE_BYTES,
  NON_3D_BUDGET_BYTES,
  SHELL_MARKS,
  analyse,
  chunkLibraries,
  chunkShellMarks,
  collect,
  familyKey,
  findImporters,
  findReferences,
  findVarCalls,
  group,
  gzipBytes,
  listFiles,
  main,
  normaliseHref,
  normalisePath,
  parseAttributes,
  parseDocumentReferences,
  parseFontFaces,
  parseFontUses,
  percent,
  proveFingerprints,
  render,
  resolveFontReachability,
  resolveFontUrl,
  resolveFontValue,
  resolveReference,
  resolveSpecifier,
  routeOf,
  unquote,
  wrap,
} from '../asset-budget.mjs';

// The measurer is a `.mjs` file, which `tsconfig.json` excludes from
// typechecking, so this file is where its contract is actually asserted. Every
// `describe` below is one row of the spec's I/O and edge-case matrix, followed
// by the acceptance criteria that are not matrix rows.
//
// Nothing here reads the repository's own `.next/`. The CI unit job has no
// build, and a suite that needed one would be skipped there and would then be
// asserting nothing on the only runner that gates a merge. Where a case has to
// exercise `collect`, it writes a whole scratch `.next/` of its own with known
// byte counts, so the per-route arithmetic every published figure comes from is
// observed rather than assumed.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

const scratch = (): string => mkdtempSync(join(tmpdir(), 'asset-budget-'));

/** Run `body` against a fresh scratch directory and always remove it. */
const withScratch = <T,>(body: (root: string) => T): T => {
  const root = scratch();
  try {
    return body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const write = (root: string, path: string, content: string | Buffer): void => {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
};

/**
 * Deterministic high-entropy filler. `Math.random` would make the byte counts
 * this file asserts move between runs, and a repeated string would gzip away to
 * nothing, which is useless for a case that has to breach a budget.
 */
const filler = (length: number, seed = 1): Buffer => {
  const out = Buffer.alloc(length);
  let state = seed >>> 0;
  for (let index = 0; index < length; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    out[index] = (state >>> 24) & 0xff;
  }
  return out;
};

const chunkBody = (marks: string[], bytes: number, seed: number): Buffer =>
  Buffer.concat([Buffer.from(`/*${marks.join('*//*')}*/`, 'utf8'), filler(bytes, seed)]);

/**
 * A whole production build, small enough to assert byte for byte.
 *
 * `narrativeBytes` and `shellBytes` are the filler sizes, so a case can put the
 * non-3D route over or under the 140 KB budget and the narrative inside or
 * below the 300 to 450 KB estimate without hand-writing a single total.
 */
interface BuildOptions {
  narrativeBytes?: number;
  shellBytes?: number;
  deferred?: boolean;
  missingChunk?: boolean;
}

function scratchBuild(root: string, options: BuildOptions = {}): void {
  const { narrativeBytes = 2_000, shellBytes = 3_000, deferred = false, missingChunk = false } = options;

  // Every fingerprint has to hit something or `collect` refuses, which is
  // itself asserted further down. They are split the way the real build splits
  // them: the WebGL stack in one chunk, `gsap` and `lenis` in another that the
  // routes with no 3D on them still pull. Without that split every route here
  // would carry WebGL and there would be no non-3D path to measure. The last
  // mark lives alone in `orphan.js` when the case wants a deferred chunk.
  const webglMarks = FINGERPRINTS.filter((entry) => entry.webgl).map((entry) => entry.mark);
  const plainMarks = FINGERPRINTS.filter((entry) => !entry.webgl).map((entry) => entry.mark);
  const shared = deferred ? plainMarks.slice(0, -1) : plainMarks;
  const lastMark = plainMarks.at(-1) as string;

  write(root, '.next/BUILD_ID', 'fixture-build-id');
  write(
    root,
    '.next/routes-manifest.json',
    JSON.stringify({
      redirects: [
        { source: '/gone', destination: '/pdf/gone.pdf', statusCode: 308 },
        // A parameterised source must not be matched against a concrete route.
        { source: '/:path+/', destination: '/:path+', statusCode: 308 },
      ],
    })
  );
  write(root, '.next/static/chunks/narrative.js', chunkBody(shared, narrativeBytes, 7));
  write(root, '.next/static/chunks/shell.js', chunkBody(['react-dom'], shellBytes, 11));
  write(root, '.next/static/chunks/webgl.js', chunkBody(webglMarks, 600, 59));
  write(root, '.next/static/chunks/extra.js', chunkBody([], 300, 61));
  // A chunk in a subdirectory. A non-recursive walk would never fingerprint it,
  // and the route that references it would read as carrying no WebGL.
  write(root, '.next/static/chunks/nested/deep.js', chunkBody(['WebGLRenderer'], 500, 13));
  if (deferred) write(root, '.next/static/chunks/orphan.js', chunkBody([lastMark], 400, 17));
  write(
    root,
    '.next/static/chunks/app.css',
    [
      '@font-face{font-family:"Reached";src:url(../media/reached.woff2) format("woff2"),',
      'url(../media/reached.woff) format("woff")}',
      '@font-face{font-family:"Unreached";src:url(../media/unreached.woff2) format("woff2")}',
      ':root{--f-display:"Reached",system-ui;--alias:var(--f-display)}',
      'h1{font-family:var(--alias)!important}',
    ].join('')
  );
  write(root, '.next/static/media/reached.woff2', filler(900, 23));
  write(root, '.next/static/media/reached.woff', filler(1_100, 29));
  write(root, '.next/static/media/unreached.woff2', filler(1_300, 31));
  write(root, 'contracts/fonts/only-face.woff2', filler(1_700, 37));

  // `/` carries WebGL. `narrative.js` is preloaded and scripted, which must
  // count once; the face is preloaded twice, which must also count once; and one
  // href carries a query string, one is percent encoded, and one is a
  // `rel="preload stylesheet"` token list.
  const home = [
    '<!DOCTYPE html><html><head>',
    '<link rel="preconnect" href="/" crossorigin=""/>',
    '<link rel="icon" href="/favicon.ico?v=2"/>',
    '<link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/narrative.js"/>',
    '<script src="/_next/static/chunks/narrative.js" async=""></script>',
    '<script src="/_next/static/chunks/webgl.js" async=""></script>',
    '<link rel="preload stylesheet" href="/_next/static/chunks/app.css"/>',
    '<link rel="preload" href="/fonts/re%61ched.woff2" as="font"/>',
    '<link rel="preload" href="/fonts/reached.woff2?v=2" as="font"/>',
    '</head><body></body></html>',
  ].join('\n');
  // No WebGL chunk here, and `gsap` and `lenis` on it regardless: this is the
  // shape the real non-3D routes have.
  const plain = [
    '<!DOCTYPE html><html><head>',
    '<script src="/_next/static/chunks/shell.js" async=""></script>',
    '<script src="/_next/static/chunks/narrative.js" async=""></script>',
    missingChunk ? '<script src="/_next/static/chunks/never-written.js" async=""></script>' : '',
    '<link rel="stylesheet" href="/_next/static/chunks/app.css"/>',
    '<link rel="modulepreload" href="/_next/static/chunks/extra.js"/>',
    '</head><body></body></html>',
  ].join('\n');
  const deep = [
    '<!DOCTYPE html><html><head>',
    '<script src="/_next/static/chunks/nested/deep.js" async=""></script>',
    '<link rel="stylesheet" href="/_next/static/chunks/app.css"/>',
    '</head><body></body></html>',
  ].join('\n');

  write(root, 'public/fonts/reached.woff2', filler(900, 23));
  write(root, '.next/server/app/index.html', home);
  write(root, '.next/server/app/plain.html', plain);
  write(root, '.next/server/app/gone.html', plain);
  write(root, '.next/server/app/_not-found.html', plain);
  // A nested document. Read from the basename alone it would collide with the
  // top-level `plain.html` and one of the two would be lost.
  write(root, '.next/server/app/deep/plain.html', deep);

  // A live component, an orphan, and the App Router page that imports the live
  // one through a directory specifier.
  write(root, 'app/page.tsx', "import { Live } from '@/components/atoms/Live';\nexport default Live;\n");
  write(root, 'components/atoms/Live/index.tsx', "export { Live } from './Live';\n");
  write(root, 'components/atoms/Live/Live.tsx', "export const Live = () => '/assets/home/live.png';\n");
  write(root, 'components/atoms/Dead/Dead.tsx', "export const Dead = () => '/assets/home/dead.glb';\n");
  write(root, 'components/atoms/Dead/__tests__/Dead.test.tsx', "import { Dead } from '../Dead';\n");

  write(root, 'public/assets/home/live.png', filler(400, 41));
  write(root, 'public/assets/home/live.png.map', filler(100, 43));
  write(root, 'public/assets/home/dead.glb', filler(700, 47));
  write(root, 'public/assets/home/dead.gltf', Buffer.from('{"buffers":[{"uri":"dead.bin"}]}', 'utf8'));
  write(root, 'public/assets/home/dead.bin', filler(600, 53));
}

const gz = (bytes: Buffer): number => gzipSync(bytes, { level: 9 }).length;
const read = (root: string, path: string): Buffer => readFileSync(join(root, path));

/** A fixture lookup that must succeed, so a typo in one reads as a fixture fault. */
const must = <T,>(value: T | undefined | null, what: string): T => {
  if (value === undefined || value === null) throw new Error(`the fixture has no ${what}`);
  return value;
};

// ---------------------------------------------------------------------------
// Matrix row 1: a normal run. The per-route arithmetic every published figure
// comes from, observed against a build with known byte counts.
// ---------------------------------------------------------------------------

describe('collect over a whole scratch build', () => {
  it('reads the route it can be loaded on, field by field, from the bytes on disk', () => {
    withScratch((root) => {
      scratchBuild(root);
      const model = collect(root);

      expect(model.buildId).toBe('fixture-build-id');
      expect(typeof model.commit).toBe('string');
      expect(model.builtAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

      const plain = must(
        model.routes.find((route) => route.route === '/plain'),
        'a /plain route'
      );

      const document = read(root, '.next/server/app/plain.html');
      const shell = read(root, '.next/static/chunks/shell.js');
      const narrative = read(root, '.next/static/chunks/narrative.js');
      const style = read(root, '.next/static/chunks/app.css');
      const extra = read(root, '.next/static/chunks/extra.js');

      expect(plain.bytes).toBe(document.length);
      expect(plain.gzip).toBe(gz(document));
      expect(plain.scriptGzip).toBe(gz(shell) + gz(narrative));
      expect(plain.styleGzip).toBe(gz(style));
      // `modulepreload` is folded into `preload`, so this chunk lands in the
      // preload partition rather than being dropped from the total.
      expect(plain.preloadOnlyGzip).toBe(gz(extra));
      expect(plain.preloadOnly.map((entry: { path: string }) => entry.path)).toEqual([
        '.next/static/chunks/extra.js',
      ]);
      expect(plain.wireGzip).toBe(gz(document) + gz(shell) + gz(narrative) + gz(style) + gz(extra));
      // The four partitions are exactly the wire total, with nothing counted
      // twice and nothing left out.
      expect(plain.gzip + plain.scriptGzip + plain.styleGzip + plain.preloadOnlyGzip).toBe(plain.wireGzip);
      // `gsap` and `lenis` are on it and no WebGL chunk is, which is what makes
      // it a non-3D route rather than a route with no narrative on it.
      expect(plain.webgl).toBe(false);
      expect(must(model.chunks.find((chunk) => chunk.name === 'narrative.js'), 'narrative.js').routes).toContain('/plain');
    });
  });

  it('counts a chunk that is preloaded and scripted once, and a face preloaded under three hrefs once', () => {
    withScratch((root) => {
      scratchBuild(root);
      const model = collect(root);
      const home = must(model.routes.find((route) => route.route === '/'), 'a / route');

      const paths = home.references.map((entry) => entry.path);
      expect(paths.filter((path) => path === '.next/static/chunks/narrative.js')).toHaveLength(1);
      // `/fonts/re%61ched.woff2` and `/fonts/reached.woff2?v=2` are the same
      // file. Deduplicating on the raw href would count it twice and would also
      // abort the run looking for a percent-encoded name that is not on disk.
      expect(paths.filter((path) => path === 'public/fonts/reached.woff2')).toHaveLength(1);

      const document = read(root, '.next/server/app/index.html');
      const expected =
        gz(document) +
        gz(read(root, '.next/static/chunks/narrative.js')) +
        gz(read(root, '.next/static/chunks/webgl.js')) +
        gz(read(root, '.next/static/chunks/app.css')) +
        gz(read(root, 'public/fonts/reached.woff2'));
      expect(home.wireGzip).toBe(expected);
      expect(home.webgl).toBe(true);

      // `rel="preload stylesheet"` is both, so it is a stylesheet here and not
      // a preload-only entry.
      const css = must(
        home.references.find((entry) => entry.path.endsWith('app.css')),
        'the app.css reference'
      );
      expect(css.kinds).toEqual(['preload', 'stylesheet']);
      expect(home.styleGzip).toBe(gz(read(root, '.next/static/chunks/app.css')));
    });
  });

  it('walks chunks and documents recursively, and names a nested route by its whole path', () => {
    withScratch((root) => {
      scratchBuild(root);
      const model = collect(root);
      expect(model.routes.map((route) => route.route).sort()).toEqual([
        '/',
        '/_not-found',
        '/deep/plain',
        '/gone',
        '/plain',
      ]);
      const nested = must(
        model.chunks.find((chunk) => chunk.name === 'nested/deep.js'),
        'the nested chunk'
      );
      expect(nested.webgl).toBe(true);
      expect(nested.routes).toContain('/deep/plain');
    });
  });

  it('reads which routes are served from the manifest rather than leaving it to the reader', () => {
    withScratch((root) => {
      scratchBuild(root);
      const model = collect(root);
      const byRoute = new Map(model.routes.map((route) => [route.route, route]));
      expect(must(byRoute.get('/gone'), '/gone').redirect).toEqual({ destination: '/pdf/gone.pdf', statusCode: 308 });
      expect(must(byRoute.get('/plain'), '/plain').redirect).toBeNull();
      expect(must(byRoute.get('/_not-found'), '/_not-found').internal).toBe(true);
      expect(must(byRoute.get('/plain'), '/plain').internal).toBe(false);

      const { non3d } = analyse(model);
      // `/gone` is answered by its redirect and `/_not-found` is Next's own, so
      // neither can be the route a budget is checked against.
      expect(non3d.routes.map((route) => route.route).sort()).toEqual([
        '/_not-found',
        '/gone',
        '/plain',
      ]);
      expect(non3d.served.map((route) => route.route)).toEqual(['/plain']);
      expect(non3d.heaviest?.route).toBe('/plain');
    });
  });

  it('weighs every format a family declares, not only its woff2', () => {
    withScratch((root) => {
      scratchBuild(root);
      const model = collect(root);
      const reached = must(model.fonts.families.find((entry) => entry.family === 'Reached'), 'the Reached family');
      expect(reached.files.map((file) => file.format)).toEqual(['woff2', 'woff']);
      expect(reached.bytes).toBe(900 + 1_100);
      expect(reached.gzip).toBe(gz(read(root, '.next/static/media/reached.woff2')) + gz(read(root, '.next/static/media/reached.woff')));
      // The alias chain is two hops and the rule carries `!important`.
      expect(reached.reachable).toBe(true);
      expect(model.fonts.unreachable).toEqual(['Unreached']);
      expect(model.fonts.families).toHaveLength(2);
    });
  });

  it('resolves asset liveness through the source tree and along the sibling chain', () => {
    withScratch((root) => {
      scratchBuild(root);
      const model = collect(root);
      const byName = new Map(model.assets.map((asset) => [asset.name, asset]));

      // Named from a component that `app/page.tsx` reaches through a directory
      // specifier and a barrel re-export.
      expect(must(byName.get('live.png'), 'live.png').live).toBe(true);
      expect(must(byName.get('live.png'), 'live.png').orphanedReferrers).toEqual([]);
      // Bounded matching: `live.png` must not be reported as referenced by the
      // line that names `live.png.map`, and the map file is named by nothing.
      expect(must(byName.get('live.png.map'), 'live.png.map').referrers).toEqual([]);

      expect(must(byName.get('dead.glb'), 'dead.glb').live).toBe(false);
      expect(must(byName.get('dead.glb'), 'dead.glb').orphanedReferrers).toEqual(['components/atoms/Dead/Dead.tsx']);
      // `dead.bin` is named only by `dead.gltf`, which is named by nothing, so
      // the answer has to come from following the chain rather than one pass.
      expect(must(byName.get('dead.bin'), 'dead.bin').fromSource).toEqual([]);
      expect(must(byName.get('dead.bin'), 'dead.bin').fromSibling).toEqual(['public/assets/home/dead.gltf:1']);
      expect(must(byName.get('dead.bin'), 'dead.bin').live).toBe(false);

      expect(model.orphanModules).toEqual(['components/atoms/Dead/Dead.tsx']);
    });
  });

  it('keeps a live sibling chain live, so an asset a reached asset names is reached', () => {
    withScratch((root) => {
      scratchBuild(root);
      // Make the manifest live by naming it from the component the page reaches.
      write(root, 'components/atoms/Live/Live.tsx', "export const Live = () => '/assets/home/dead.gltf';\n");
      const model = collect(root);
      const byName = new Map(model.assets.map((asset) => [asset.name, asset]));
      expect(must(byName.get('dead.gltf'), 'dead.gltf').live).toBe(true);
      expect(must(byName.get('dead.bin'), 'dead.bin').live).toBe(true);
    });
  });

  it('renders the asset table, both reachability rows and the orphan prose', () => {
    withScratch((root) => {
      scratchBuild(root);
      const printed = render(collect(root));
      expect(printed).toContain('## The narrative assets');
      expect(printed).toContain('`dead.glb`');
      expect(printed).toContain('imported by nothing');
      expect(printed).toContain('Reachable from a module something imports');
      expect(printed).toContain('Reachable from nothing');
      expect(printed).toContain('Components outside `app/` that nothing imports');
      expect(printed).toContain('`components/atoms/Dead/Dead.tsx`');
      // The App Router page is an entry point, so it is never an orphan.
      expect(printed).not.toContain('`app/page.tsx`');
    });
  });

  it('prints the same bytes twice from one build', () => {
    withScratch((root) => {
      scratchBuild(root);
      expect(render(collect(root))).toBe(render(collect(root)));
    });
  });
});

// ---------------------------------------------------------------------------
// Matrix rows 7 and 8: the budget comparison, and a breach. Both readings, both
// narrative verdicts, and the deferred branch, all off builds `collect`
// produced rather than off a hand-written model.
// ---------------------------------------------------------------------------

describe('a build that breaches the budget', () => {
  it('records the overage, names the largest contributor, and still returns a reading', () => {
    withScratch((root) => {
      scratchBuild(root, { narrativeBytes: 350_000, shellBytes: 160_000, deferred: true });
      const model = collect(root);
      const { non3d, narrative, largest } = analyse(model);

      expect(non3d.heaviest?.route).toBe('/plain');
      expect(non3d.measured).toBeGreaterThan(NON_3D_BUDGET_BYTES);
      expect(largest?.path).toBe('.next/static/chunks/narrative.js');

      const printed = render(model);
      expect(printed).toContain('**Overage**');
      expect(printed).toContain(group(non3d.measured - NON_3D_BUDGET_BYTES));
      expect(printed).toContain('over budget as measured');
      // Story 2-34 is the gate story. Nothing here throws on a breach, so the
      // command line exits 0 and the reading reaches the record.
      expect(() => render(model)).not.toThrow();
      expect(main([], root).ok).toBe(true);

      // The verdict the record actually publishes.
      expect(narrative.gzip).toBeGreaterThanOrEqual(NARRATIVE_ESTIMATE_BYTES[0]);
      expect(narrative.gzip).toBeLessThanOrEqual(NARRATIVE_ESTIMATE_BYTES[1]);
      expect(printed).toContain('inside the range');
      expect(printed).toContain(`${group(NARRATIVE_ESTIMATE_BYTES[1] - narrative.gzip)} below the top`);
    });
  });

  it('reports the deferred chunk separately from the bytes on a document at first paint', () => {
    withScratch((root) => {
      scratchBuild(root, { narrativeBytes: 350_000, shellBytes: 160_000, deferred: true });
      const model = collect(root);
      const { narrative } = analyse(model);
      expect(narrative.deferred.map((chunk: { name: string }) => chunk.name)).toEqual(['orphan.js']);
      expect(narrative.deferredGzip).toBeGreaterThan(0);
      expect(narrative.gzip).toBe(narrative.deferredGzip + narrative.onWireGzip);
      const printed = render(model);
      expect(printed).toContain('bytes of that is genuinely deferred');
      expect(printed).toContain('`orphan.js`');
    });
  });

  it('says so plainly when nothing is deferred', () => {
    withScratch((root) => {
      scratchBuild(root);
      const printed = render(collect(root));
      expect(printed).toContain('No narrative chunk is deferred');
    });
  });

  it('is inside budget, and under the foot of the estimate, on a small build', () => {
    withScratch((root) => {
      scratchBuild(root);
      const model = collect(root);
      const { non3d, narrative } = analyse(model);
      expect(non3d.measured).toBeLessThan(NON_3D_BUDGET_BYTES);
      expect(narrative.gzip).toBeLessThan(NARRATIVE_ESTIMATE_BYTES[0]);
      const printed = render(model);
      expect(printed).toContain('| Margin |');
      expect(printed).toContain('inside budget as measured');
      expect(printed).toContain('under the foot of the range');
    });
  });

  it('holds the budget constants the record states', () => {
    expect(KB).toBe(1000);
    expect(NON_3D_BUDGET_BYTES).toBe(140_000);
    expect(FONT_BUDGET_BYTES).toBe(120_000);
    expect(HTML_AND_CSS_BUDGET_BYTES).toBe(20_000);
    expect(NARRATIVE_ESTIMATE_BYTES).toEqual([300_000, 450_000]);
  });

  it('derives the font line label from what it actually weighed', () => {
    withScratch((root) => {
      scratchBuild(root);
      // One face in `contracts/fonts/`, so the label must not say three.
      expect(render(collect(root))).toContain('Fonts: the 1 latin subsets in `contracts/fonts/`');
    });
  });
});

// ---------------------------------------------------------------------------
// Matrix row 2: refusals. Nothing here needs a build, which is the point.
// ---------------------------------------------------------------------------

describe('what this tool will not measure', () => {
  it('refuses a tree with no build, names the build command, and prints no table', () => {
    withScratch((root) => {
      const result = main([], root);
      expect(result.ok).toBe(false);
      expect(result.message).toContain('corepack pnpm build');
      expect(result.message).toContain('.next/BUILD_ID');
      expect(result.message).not.toContain('| Nature |');
    });
  });

  it('refuses when BUILD_ID is there and the chunks are not', () => {
    withScratch((root) => {
      write(root, '.next/BUILD_ID', 'pretend');
      const result = main([], root);
      expect(result.ok).toBe(false);
      expect(result.message).toContain('.next/static/chunks');
    });
  });

  it('names an empty build as an empty build, not as a fingerprint problem', () => {
    withScratch((root) => {
      write(root, '.next/BUILD_ID', 'pretend');
      write(root, '.next/static/chunks/only.css', 'a{color:red}');
      const result = main([], root);
      expect(result.ok).toBe(false);
      expect(result.message).toContain('holds no .js file');
      expect(result.message).not.toContain('fingerprint table');
    });
  });

  it('refuses a build with no stylesheet, rather than reporting every family unreachable', () => {
    withScratch((root) => {
      write(root, '.next/BUILD_ID', 'pretend');
      write(root, '.next/static/chunks/only.js', 'x');
      const result = main([], root);
      expect(result.ok).toBe(false);
      expect(result.message).toContain('holds no .css file');
    });
  });

  it('fails loudly and names the href when a document references a file the build did not write', () => {
    withScratch((root) => {
      scratchBuild(root, { missingChunk: true });
      const result = main([], root);
      expect(result.ok).toBe(false);
      expect(result.message).toContain('/_next/static/chunks/never-written.js');
      expect(result.message).toContain('.next/static/chunks/never-written.js');
      expect(result.message).toContain('is not on disk');
      expect(result.message).not.toContain('| Nature |');
    });
  });

  it('refuses a built @font-face naming a file the build did not write', () => {
    withScratch((root) => {
      scratchBuild(root);
      rmSync(join(root, '.next/static/media/unreached.woff2'));
      const result = main([], root);
      expect(result.ok).toBe(false);
      expect(result.message).toContain('Unreached');
      expect(result.message).toContain('unreached.woff2');
    });
  });

  it('refuses when contracts/fonts holds no face, because a font line of zero looks like a pass', () => {
    withScratch((root) => {
      scratchBuild(root);
      rmSync(join(root, 'contracts/fonts/only-face.woff2'));
      const result = main([], root);
      expect(result.ok).toBe(false);
      expect(result.message).toContain('contracts/fonts holds no .woff2');
    });
  });

  it('takes no arguments, and says so rather than silently ignoring one', () => {
    withScratch((root) => {
      const result = main(['--root=/somewhere'], root);
      expect(result.ok).toBe(false);
      expect(result.message).toContain('takes no arguments');
      expect(result.message).toContain('usage: node ops/asset-budget.mjs');
    });
  });

  it('answers --help with the usage line and no error', () => {
    withScratch((root) => {
      const result = main(['--help'], root);
      expect(result.ok).toBe(true);
      expect(result.message).toContain('usage: node ops/asset-budget.mjs');
    });
  });
});

// ---------------------------------------------------------------------------
// Matrix row 3: route enumeration.
// ---------------------------------------------------------------------------

describe('what a prerendered document references', () => {
  // Shaped on the real `/celeste` document: a preconnect that points at `/`, an
  // icon with a query string, one chunk that is both preloaded and scripted, a
  // `noModule` polyfill, and the two font preloads the root layout writes twice
  // because React hoists them beside the ones already in the markup.
  const html = `<!DOCTYPE html><html><head>
<link rel="preconnect" href="/" crossorigin=""/>
<link rel="preload" href="/fonts/MonumentExtended-Bold.woff2" as="font" crossorigin="anonymous" type="font/woff2"/>
<link rel="stylesheet" href="/_next/static/chunks/a.css" data-precedence="next"/>
<link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/entry.js"/>
<link rel="icon" href="/favicon.ico?favicon.hash.ico" sizes="16x16" type="image/x-icon"/>
<script src="/_next/static/chunks/entry.js" id="_R_" async=""></script>
<script src="/_next/static/chunks/poly.js" noModule=""></script>
<link rel="preload" href="/fonts/MonumentExtended-Bold.woff2" as="font" type="font/woff2" crossorigin="anonymous"/>
<link rel="MODULEPRELOAD" href="/_next/static/chunks/mod.js"/>
<link rel="preload stylesheet" href="/_next/static/chunks/both.css"/>
<script>self.__next_f=[]</script>
</head><body></body></html>`;

  const references = parseDocumentReferences(html);
  const byPath = new Map(references.map((entry) => [entry.path, entry]));

  it('takes scripts, stylesheets, preloads and modulepreloads, and nothing else', () => {
    expect([...byPath.keys()].sort()).toEqual([
      '.next/static/chunks/a.css',
      '.next/static/chunks/both.css',
      '.next/static/chunks/entry.js',
      '.next/static/chunks/mod.js',
      '.next/static/chunks/poly.js',
      'public/fonts/MonumentExtended-Bold.woff2',
    ]);
    // The preconnect points at `/` and fetches nothing; the icon is neither a
    // script, a stylesheet nor a preload. Counting either would inflate a total
    // that a budget is checked against.
    expect(byPath.has('public/favicon.ico')).toBe(false);
  });

  it('reads `rel` as a token list, so `preload stylesheet` is both', () => {
    expect(byPath.get('.next/static/chunks/both.css')?.kinds).toEqual(['preload', 'stylesheet']);
    // Case-insensitive, and `modulepreload` costs the same download as a
    // preload, so it is folded into that partition rather than dropped.
    expect(byPath.get('.next/static/chunks/mod.js')?.kinds).toEqual(['preload']);
  });

  it('counts a chunk that is both preloaded and scripted once, and keeps both kinds', () => {
    expect(references.filter((entry) => entry.path === '.next/static/chunks/entry.js')).toHaveLength(1);
    expect(byPath.get('.next/static/chunks/entry.js')?.kinds).toEqual(['preload', 'script']);
    expect(byPath.get('.next/static/chunks/entry.js')?.fetchPriority).toBe('low');
  });

  it('counts a face preloaded twice in one document once', () => {
    expect(references.filter((entry) => entry.path?.endsWith('MonumentExtended-Bold.woff2'))).toHaveLength(1);
    expect(byPath.get('public/fonts/MonumentExtended-Bold.woff2')?.as).toBe('font');
  });

  it('carries `noModule` rather than dropping it, because no modern browser fetches that script', () => {
    expect(byPath.get('.next/static/chunks/poly.js')?.noModule).toBe(true);
    expect(byPath.get('.next/static/chunks/entry.js')?.noModule).toBe(false);
  });

  it('is deterministic in its order, so two runs of the tool cannot differ on it', () => {
    expect(parseDocumentReferences(html)).toEqual(references);
    expect([...byPath.keys()]).toEqual([...byPath.keys()].sort());
  });

  it('reads a valueless attribute as present', () => {
    const attributes = parseAttributes(' src="/x.js" noModule="" async=""');
    expect(attributes.src).toBe('/x.js');
    expect('nomodule' in attributes).toBe(true);
  });

  it('resolves an href to a file this build would have written', () => {
    expect(resolveReference('/_next/static/chunks/a.css')).toBe('.next/static/chunks/a.css');
    expect(resolveReference('/fonts/x.woff2')).toBe('public/fonts/x.woff2');
    expect(resolveReference('/favicon.ico?hash.ico')).toBe('public/favicon.ico');
    // A percent-encoded href names a file whose plain name is on disk. Without
    // the decode the run aborts claiming a file that exists is missing.
    expect(resolveReference('/fonts/My%20Face.woff2')).toBe('public/fonts/My Face.woff2');
    expect(resolveReference('/x.js#frag')).toBe('public/x.js');
    expect(normaliseHref('/a%ZZb.js')).toBe('/a%ZZb.js');
    expect(normalisePath(['a', 'b/../c', './d'])).toBe('a/c/d');
  });

  it('answers nothing for an href this build does not serve', () => {
    expect(resolveReference('/')).toBeNull();
    expect(resolveReference('https://example.test/x.js')).toBeNull();
    expect(resolveReference('//cdn.example.test/x.js')).toBeNull();
    expect(resolveReference('')).toBeNull();
  });

  it('names a route from its whole path, so a nested document is its own route', () => {
    expect(routeOf('index.html')).toBe('/');
    expect(routeOf('celeste.html')).toBe('/celeste');
    expect(routeOf('_not-found.html')).toBe('/_not-found');
    expect(routeOf('blog/post.html')).toBe('/blog/post');
    expect(routeOf('blog/index.html')).toBe('/blog');
  });
});

// ---------------------------------------------------------------------------
// Matrix row 4: chunk attribution.
// ---------------------------------------------------------------------------

describe('classifying a chunk by fingerprint', () => {
  const threeChunk = 'e.s(["WebGLRenderer",0,()=>n.WebGLRenderer]),console.warn("THREE.WebGLRenderer: x")';
  const fiberChunk = 'let R="react-three-fiber";';

  // The near miss that decides the whole method. This is the shape of a real
  // 1,925 byte chunk in the build `ops/asset-budget.md` records: app code that
  // names a gsap helper of its own and carries no gsap. A fingerprint of `gsap`
  // would attribute the whole chunk to the narrative bundle and overstate the
  // number this story exists to measure.
  const appChunk =
    'e.s(["useGsapContext",0,function(e,s=[]){let l=r.default.context(e,l)}]),' +
    'o.gsap.registerPlugin(r.ScrollTrigger),n.OrbitControls';

  it('classifies a chunk carrying three as narrative-bearing', () => {
    expect(chunkLibraries(threeChunk)).toContain('three');
    expect(chunkLibraries(fiberChunk)).toEqual(['@react-three/fiber']);
  });

  it('does not classify app code that merely names gsap, ScrollTrigger or OrbitControls', () => {
    expect(chunkLibraries(appChunk)).toEqual([]);
  });

  it('names a shell chunk by evidence, so the largest contributor is not quoted as a hash', () => {
    expect(chunkShellMarks('x=require("react-dom/client")')).toEqual(['react-dom']);
    expect(chunkShellMarks(appChunk)).toEqual([]);
  });

  it('proves every fingerprint against every chunk, and reports the hit set with counts', () => {
    const proof = proveFingerprints(
      FINGERPRINTS.map((entry) => ({ name: `${entry.library}.js`, text: `${entry.mark} and ${entry.mark}` }))
    );
    expect(proof).toHaveLength(FINGERPRINTS.length);
    for (const entry of proof) {
      expect(entry.hits).toEqual([{ name: `${entry.library}.js`, count: 2 }]);
    }
  });

  it('refuses when a fingerprint matches no chunk, and names the library and the mark', () => {
    const chunks = FINGERPRINTS.slice(1).map((entry) => ({ name: `${entry.library}.js`, text: entry.mark }));
    let thrown: unknown = null;
    try {
      proveFingerprints(chunks);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(BudgetError);
    expect(String(thrown)).toContain(FINGERPRINTS[0].library);
    expect(String(thrown)).toContain(FINGERPRINTS[0].mark);
    // A silently-empty attribution would print a narrative total of zero and
    // read like a passing budget, which is the failure this refusal exists for.
    expect(String(thrown)).toContain('do not widen it');
  });

  it('refuses an empty fingerprint rather than scanning forever on it', () => {
    expect(() => proveFingerprints([{ name: 'a.js', text: 'anything' }], [{ library: 'x', mark: '', webgl: false }])).toThrow(
      BudgetError
    );
  });

  it('keeps the fingerprint table exactly as the record states it', () => {
    // The record publishes these marks and the proof that each discriminates.
    // Adding, removing or loosening one moves a published figure, so it moves
    // this list in the same commit or it does not land.
    expect(FINGERPRINTS.map((entry) => [entry.library, entry.mark, entry.webgl])).toEqual([
      ['three', 'WebGLRenderer', true],
      ['@react-three/fiber', 'react-three-fiber', true],
      ['@react-three/drei', 'onIncline', true],
      ['three-stdlib', 'OrbitControls.js encountered', true],
      ['@react-three/postprocessing', '@react-three/postprocessing', true],
      ['postprocessing', 'KawaseBlurPass', true],
      ['gsap', 'GSAP target ', false],
      ['gsap/ScrollTrigger', 'scrollerProxy', false],
      ['gsap/SplitText', 'SplitText called before fonts loaded', false],
      ['lenis', 'lenisVersion', false],
    ]);
    expect(SHELL_MARKS.map((entry) => entry.mark)).toEqual(['react-dom', 'flightRouterState', 'core-js']);
  });
});

// ---------------------------------------------------------------------------
// Matrix row 5: font reachability.
// ---------------------------------------------------------------------------

describe('which declared faces a font-family rule can reach', () => {
  // Two hops, which is what the real build carries: `--monument-bold` holds
  // `var(--f-display)`, which holds the family. A resolver that stopped after
  // one hop would call Bricolage Grotesque unreachable and hand a later story a
  // reason to delete a face that is on every page.
  const css = `
@font-face{font-family:"Bricolage Grotesque";src:url(../media/bricolage.woff2) format("woff2")}
@font-face{font-family:'Confillia Normal';src:url(../media/confillia.woff2) format("woff2")}
@font-face{font-family:MonumentExtended-Bold;src:url(../media/monument.woff2) format("woff2")}
@font-face{font-family:"Fallback Only";src:url(../media/fallback.woff2) format("woff2")}
@font-face{font-family:"Cased";src:url(../media/cased.woff2) format("woff2")}
:root{--f-display:"Bricolage Grotesque","Archivo",system-ui,sans-serif;--monument-bold:var(--f-display);
--confillia-normal:"Confillia Normal"}
h1{font-family:var(--monument-bold);font-weight:900}
p{font-family:var(--confillia-normal)!important}
aside{font-family:var(--never-defined, "Fallback Only"),sans-serif}
b{font-family:  cased  }
figcaption{font-family:var(--never-defined)}
`;
  const resolved = resolveFontReachability(css);

  it('reads every declared family and the urls beside it', () => {
    expect(parseFontFaces(css).map((face) => face.family)).toEqual([
      'Bricolage Grotesque',
      'Confillia Normal',
      'MonumentExtended-Bold',
      'Fallback Only',
      'Cased',
    ]);
    expect(parseFontFaces(css)[0].urls).toEqual(['../media/bricolage.woff2']);
  });

  it('follows a two-hop var() chain to the family it names', () => {
    const properties = parseFontUses(css).properties;
    expect(resolveFontValue('var(--monument-bold)', properties).families[0]).toBe('Bricolage Grotesque');
  });

  it('follows the fallback arm, so a face reached only through one is reached', () => {
    expect(resolved.reachable).toContain('Fallback Only');
    const calls = findVarCalls('var(--a, var(--b, "Geist")) , serif');
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('--a');
    expect(calls[0].fallback).toBe('var(--b, "Geist")');
  });

  it('matches a family case-insensitively and ignores a trailing !important', () => {
    expect(resolved.reachable).toContain('Cased');
    expect(resolved.reachable).toContain('Confillia Normal');
    expect(familyKey('  "Geist  Mono" !important ')).toBe('geist mono');
  });

  it('reports a family no rule names as unreachable, however faithfully it is built', () => {
    expect(resolved.unreachable).toEqual(['MonumentExtended-Bold']);
  });

  it('counts families, not blocks, so the numerator and the denominator are one set', () => {
    const twice = resolveFontReachability(
      '@font-face{font-family:"A";src:url(a.woff2)}@font-face{font-family:"A";src:url(b.woff2)}h1{font-family:B}'
    );
    expect(twice.faces).toHaveLength(2);
    expect(twice.families).toHaveLength(1);
    expect(twice.families[0].blocks).toBe(2);
    expect(twice.families[0].urls).toEqual(['a.woff2', 'b.woff2']);
    expect(twice.unreachable).toEqual(['A']);
  });

  it('never counts a `@font-face` descriptor as a use of the family it declares', () => {
    // Without stripping the `@font-face` blocks first, every declared family
    // would look reachable and the reachability column would say nothing.
    expect(parseFontUses(css).uses).toEqual([
      'cased',
      'var(--confillia-normal)',
      'var(--monument-bold)',
      'var(--never-defined)',
      'var(--never-defined, "Fallback Only"),sans-serif',
    ]);
  });

  it('reports an unresolvable custom property as unresolved, never as unreachable', () => {
    expect(resolved.unresolved).toEqual(['--never-defined']);
    expect(resolveFontValue('var(--never-defined)', new Map()).families).toEqual([]);
  });

  it('reports a chain that outruns the hop limit as unresolved, not as reaching nothing', () => {
    const properties = new Map([
      ['--a', 'var(--b)'],
      ['--b', 'var(--a)'],
    ]);
    const answer = resolveFontValue('var(--a)', properties);
    expect(answer.families).toEqual([]);
    expect(answer.unresolved.length).toBeGreaterThan(0);
  });

  it('treats a quoted and an unquoted family name as one family', () => {
    expect(unquote('"Geist"')).toBe('Geist');
    expect(unquote("  'Confillia Normal' ")).toBe('Confillia Normal');
    expect(unquote(' MonumentExtended-Bold ')).toBe('MonumentExtended-Bold');
    expect(unquote('"Geist" !important')).toBe('Geist');
  });

  it('resolves a face url against the chunk that declares it, and against public/fonts', () => {
    expect(resolveFontUrl('../media/x.woff2')).toEqual([
      '.next/static/media/x.woff2',
      'public/fonts/x.woff2',
    ]);
    expect(resolveFontUrl('/fonts/x.woff2')).toEqual(['public/fonts/x.woff2']);
    expect(resolveFontUrl('/_next/static/media/x.woff2')).toEqual(['.next/static/media/x.woff2']);
    // A `data:` URI fetches no file of this build's, so it is not a missing one.
    expect(resolveFontUrl('data:font/woff2;base64,AA')).toEqual([]);
    expect(resolveFontUrl('https://example.test/x.woff2')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Matrix row 6: narrative assets, and what names them.
// ---------------------------------------------------------------------------

describe('finding what references an asset', () => {
  const build = (root: string): void => {
    write(root, 'components/atoms/Gem/Gem.tsx', ["import { Mesh } from 'three';", "load('/assets/home/gem.glb');"].join('\n'));
    write(root, 'components/atoms/Gem/Facet.tsx', "export const Facet = () => null;\n");
    write(root, 'components/molecules/Live/Live.tsx', 'export const Live = () => null;\n');
    write(root, 'components/molecules/Live/index.tsx', "export { Live } from './Live';\n");
    write(root, 'components/molecules/Live/__tests__/Live.test.tsx', "import { Gem } from '@/components/atoms/Gem/Gem';\n");
    write(root, 'components/molecules/Side/Side.tsx', "import './Side.scss';\nexport const Side = () => null;\n");
    write(root, 'app/page.tsx', ["import { Live } from '@/components/molecules/Live';", "import '@/components/molecules/Side/Side';"].join('\n'));
  };

  it('names the `path:line` that carries the asset name, on a word boundary', () => {
    withScratch((root) => {
      build(root);
      const files = listFiles(root, 'components', ['.tsx']);
      expect(findReferences(root, files, 'gem.glb')).toEqual(['components/atoms/Gem/Gem.tsx:2']);
      // `gem.gl` is a prefix of `gem.glb`, and a bare `includes` would hit.
      expect(findReferences(root, files, 'gem.gl')).toEqual([]);
      expect(findReferences(root, files, 'nothing-names-this.png')).toEqual([]);
    });
  });

  it('never walks into `__tests__`, because a test importing a component puts nothing on the wire', () => {
    withScratch((root) => {
      build(root);
      expect(listFiles(root, 'components', ['.tsx'])).toEqual([
        'components/atoms/Gem/Facet.tsx',
        'components/atoms/Gem/Gem.tsx',
        'components/molecules/Live/Live.tsx',
        'components/molecules/Live/index.tsx',
        'components/molecules/Side/Side.tsx',
      ]);
    });
  });

  it('answers no importer for a module only a test names, which is the orphan finding', () => {
    withScratch((root) => {
      build(root);
      const modules = [...listFiles(root, 'app', ['.tsx']), ...listFiles(root, 'components', ['.tsx'])];
      expect(findImporters(root, modules, 'components/atoms/Gem/Gem.tsx')).toEqual([]);
      expect(findImporters(root, modules, 'components/molecules/Live/Live.tsx')).toEqual([
        'components/molecules/Live/index.tsx:1',
      ]);
    });
  });

  it('accepts a directory specifier as its index, and a bare side-effect import', () => {
    withScratch((root) => {
      build(root);
      const modules = [...listFiles(root, 'app', ['.tsx']), ...listFiles(root, 'components', ['.tsx'])];
      // `@/components/molecules/Live` is the barrel, not the file.
      expect(findImporters(root, modules, 'components/molecules/Live/index.tsx')).toEqual(['app/page.tsx:1']);
      // `import '...'` with no `from` still puts the module on the graph.
      expect(findImporters(root, modules, 'components/molecules/Side/Side.tsx')).toEqual(['app/page.tsx:2']);
    });
  });

  it('resolves the `@/` alias and a relative specifier, and ignores a bare package', () => {
    expect(resolveSpecifier('app/page.tsx', '@/components/atoms/Gem/Gem')).toBe('components/atoms/Gem/Gem');
    expect(resolveSpecifier('components/atoms/Gem/Gem.tsx', './Facet')).toBe('components/atoms/Gem/Facet');
    expect(resolveSpecifier('components/atoms/Gem/Gem.tsx', '../Scene/Scene')).toBe('components/atoms/Scene/Scene');
    expect(resolveSpecifier('components/atoms/Gem/Gem.tsx', '.')).toBe('components/atoms/Gem');
    expect(resolveSpecifier('app/page.tsx', 'three')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The three committed faces, re-measured, so the record and the binaries cannot
// drift apart. This is the same idiom as
// `packages/fonts/__tests__/fonts-contract.test.ts:574-575`, run here because
// `ops/asset-budget.md` states these three figures in its own budget table.
// ---------------------------------------------------------------------------

describe('the three published faces the record states', () => {
  interface Faces {
    budgetBytes: number;
    totalBytes: number;
    totalGzipBytes: number;
    faces: { file: string; bytes: number; gzipBytes: number }[];
  }
  let faces: Faces;
  let measured: { file: string; bytes: number; gzip: number }[];

  // Read here rather than at collection time: a missing or reshaped input must
  // fail one named case, not take the whole file down before a single `it` runs.
  beforeAll(() => {
    faces = JSON.parse(readFileSync(join(REPO_ROOT, 'packages', 'fonts', 'faces.json'), 'utf8')) as Faces;
    const faceDir = join(REPO_ROOT, 'contracts', 'fonts');
    measured = faces.faces.map((face) => {
      const bytes = readFileSync(join(faceDir, face.file));
      return { file: face.file, bytes: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length };
    });
  });

  it('re-measures each committed binary to the figures ops/asset-budget.md prints', () => {
    expect(measured).toEqual([
      { file: 'bricolage-grotesque-latin.woff2', bytes: 58_992, gzip: 59_030 },
      { file: 'geist-latin.woff2', bytes: 24_124, gzip: 24_152 },
      { file: 'geist-mono-latin.woff2', bytes: 11_284, gzip: 11_307 },
    ]);
  });

  it('totals to the font line ops/asset-budget.md compares against the 120 KB budget', () => {
    expect(measured.reduce((total, face) => total + face.bytes, 0)).toBe(94_400);
    expect(measured.reduce((total, face) => total + face.gzip, 0)).toBe(94_489);
  });

  it('agrees with packages/fonts/faces.json in both directions', () => {
    // If these two ever disagree, one of them is wrong and that is a finding,
    // not a rounding difference to absorb.
    expect(measured.map((face) => face.bytes)).toEqual(faces.faces.map((face) => face.bytes));
    expect(measured.map((face) => face.gzip)).toEqual(faces.faces.map((face) => face.gzipBytes));
    expect(faces.totalBytes).toBe(94_400);
    expect(faces.totalGzipBytes).toBe(94_489);
    expect(faces.budgetBytes).toBe(FONT_BUDGET_BYTES);
  });

  it('gzips at level 9, the level ops/font-contract.md records, and not at the default', () => {
    // Level 9 and the default differ on real input, so the two records would
    // print different numbers for the same bytes if this ever drifted.
    const sample = readFileSync(join(REPO_ROOT, 'contracts', 'tokens.css'));
    expect(gzipBytes(sample)).toBe(gzipSync(sample, { level: 9 }).length);
    expect(gzipBytes(sample)).toBeLessThan(gzipSync(sample).length);
  });
});

// ---------------------------------------------------------------------------
// Formatting, because two runs printing byte-identical output is an acceptance
// criterion and every one of these is a way to break it.
// ---------------------------------------------------------------------------

describe('the printed block', () => {
  it('groups digits without toLocaleString, which answers differently under a different locale', () => {
    expect(group(0)).toBe('0');
    expect(group(999)).toBe('999');
    expect(group(1000)).toBe('1,000');
    expect(group(2_025_358)).toBe('2,025,358');
    expect(group(-1234)).toBe('-1,234');
  });

  it('states a margin as a share of the budget, to one place', () => {
    expect(percent(35_000, 140_000)).toBe('25.0 percent');
    expect(percent(1, 0)).toBe('n/a');
  });

  it('wraps prose to a fixed column, so the block is pasted rather than re-flowed', () => {
    const lines = wrap('one two three four five six seven eight nine ten', '', 20);
    expect(lines.every((line) => line.length <= 20)).toBe(true);
    expect(lines.join(' ')).toBe('one two three four five six seven eight nine ten');
  });

  it('indents a wrapped bullet under its marker', () => {
    const lines = wrap('- a finding that runs past the column and has to continue', '  ', 30);
    expect(lines[0].startsWith('- ')).toBe(true);
    expect(lines.slice(1).every((line) => line.startsWith('  '))).toBe(true);
  });

  it('gives a word longer than the column its own line rather than cutting it', () => {
    expect(wrap('short averyveryverylongtokenindeed', '', 10)).toEqual(['short', 'averyveryverylongtokenindeed']);
  });

  it('ends in exactly one newline, so a hashed capture carries no trailing blank line', () => {
    withScratch((root) => {
      scratchBuild(root);
      const printed = render(collect(root));
      expect(printed.endsWith('\n')).toBe(true);
      expect(printed.endsWith('\n\n')).toBe(false);
    });
  });
});
