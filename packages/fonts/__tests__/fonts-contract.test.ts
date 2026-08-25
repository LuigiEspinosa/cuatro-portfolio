// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// `contracts/fonts.css` and the three woff2 files beside it are published
// artefacts, not TypeScript, so no import can reach them. This file is where
// their contract is asserted, on the same precedent as
// `packages/tokens/__tests__/tokens-contract.test.ts` and
// `ops/__tests__/library-backup.test.ts`.
//
// Every `describe` below is one row of the spec's I/O and edge-case matrix,
// followed by the acceptance criteria that are not matrix rows.
//
// Two kinds of case. The reads assert what the committed files declare. The
// refusal cases run the real generator against a corrupted copy of its inputs,
// because a refusal with only a one-time probe behind it is not known to still
// work: the committed inputs are correct, so every refusal path is dead code as
// far as the rest of this suite is concerned.

/** The budget for a case that spawns `node packages/fonts/build.mjs` for real. */
const SPAWN_TIMEOUT = 120_000;

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(HERE, '..');
const REPO_ROOT = resolve(PACKAGE_ROOT, '..', '..');
const CONTRACTS = join(REPO_ROOT, 'contracts');
const PUBLISHED = join(CONTRACTS, 'fonts.css');
const FACE_DIR = join(CONTRACTS, 'fonts');
const BUILD = join(PACKAGE_ROOT, 'build.mjs');
const FACES_JSON = join(PACKAGE_ROOT, 'faces.json');
const METRICS_JSON = join(PACKAGE_ROOT, 'fallback-metrics.json');
const TOKENS_CSS = join(CONTRACTS, 'tokens.css');
const TOKENS_MANIFEST = join(REPO_ROOT, 'packages', 'tokens', 'package.json');

const css = readFileSync(PUBLISHED, 'utf8');
const tokensCss = readFileSync(TOKENS_CSS, 'utf8');

interface Face {
  id: string;
  family: string;
  role: string;
  licence: string;
  file: string;
  licenceFile: string;
  licenceSha256: string;
  bytes: number;
  gzipBytes: number;
  sha256: string;
  glyphs: number;
  axes: Record<string, number[]>;
  axisLimits: Record<string, number | number[]>;
  unicodeRange: string;
  layoutFeatures: string[];
}

interface FacesFile {
  budgetBytes: number;
  totalBytes: number;
  totalGzipBytes: number;
  faces: Face[];
}

const faces = JSON.parse(readFileSync(FACES_JSON, 'utf8')) as FacesFile;
const metrics = JSON.parse(readFileSync(METRICS_JSON, 'utf8')) as {
  provenance: { pixelSize: number; sampleString: string; image: string };
  families: Record<
    string,
    {
      token: string;
      fallbackStack: string;
      face: { advance: number; ascent: number; descent: number; lineGap: number };
      fallback: { advance: number; ascent: number; descent: number; lineGap: number };
    }
  >;
};
const packageVersion = (JSON.parse(readFileSync(TOKENS_MANIFEST, 'utf8')) as { version: string }).version;

// ---------------------------------------------------------------------------
// Parsing. Deliberately dumb, for the same reason the token contract's parser
// is: the whole value of the published file is that a consumer in any language
// reads it with a file read and a parser rather than with a JavaScript
// toolchain.
// ---------------------------------------------------------------------------

const stripComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '');

interface Rule {
  prelude: string;
  descriptors: Map<string, string>;
}

/**
 * Splits comment-free CSS into its top-level rules. A regex over the whole text
 * has no notion of a brace, so a descriptor that has fallen outside every rule,
 * or everything after an unclosed brace, would otherwise still count toward
 * every assertion below.
 */
const rulesIn = (text: string): { rules: Rule[]; outside: string } => {
  const rules: Rule[] = [];
  let outside = '';
  let prelude = '';
  let body = '';
  let depth = 0;
  for (const character of text) {
    if (character === '{') {
      depth += 1;
      if (depth === 1) {
        body = '';
        continue;
      }
    } else if (character === '}') {
      depth -= 1;
      if (depth < 0) throw new Error('a closing brace with no opening brace');
      if (depth === 0) {
        const descriptors = new Map<string, string>();
        for (const match of body.matchAll(/([a-zA-Z-]+)\s*:\s*([^;]+);/g)) {
          descriptors.set(match[1].trim(), match[2].trim());
        }
        rules.push({ prelude: prelude.trim(), descriptors });
        prelude = '';
        continue;
      }
    }
    if (depth === 0) {
      prelude += character;
      outside += character;
    } else {
      body += character;
    }
  }
  if (depth !== 0) throw new Error('an opening brace with no closing brace');
  return { rules, outside };
};

const parsed = rulesIn(stripComments(css));
const fontFaceRules = parsed.rules.filter((rule) => rule.prelude === '@font-face');
const ruleFor = (family: string): Rule => {
  const found = fontFaceRules.find((rule) => rule.descriptors.get('font-family') === `"${family}"`);
  if (!found) {
    throw new Error(
      `contracts/fonts.css declares no @font-face with font-family: "${family}". ` +
        `It declares ${fontFaceRules.map((rule) => rule.descriptors.get('font-family')).join(', ') || 'nothing'}.`
    );
  }
  return found;
};

/** The first family in a `--f-*` stack, unquoted. This is the byte-for-byte source of the face names. */
const leadingFamily = (token: string): string => {
  const match = new RegExp(`${token}\\s*:\\s*([^;]+);`).exec(tokensCss);
  if (!match) throw new Error(`contracts/tokens.css declares no ${token}`);
  return match[1].split(',')[0].trim().replace(/^["']|["']$/g, '');
};

/** Acceptance criterion 5, and the standing AD-1 rule `AGENTS.md` states. */
const EXECUTABLE = /\.(ts|js|tsx|jsx|mjs|cjs)$/;

const filesUnder = (directory: string): string[] => {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) found.push(...filesUnder(full));
    else found.push(full);
  }
  return found;
};

const repoRelative = (file: string): string => relative(REPO_ROOT, file).split(sep).join('/');

// ---------------------------------------------------------------------------
// Running the real generator against a scratch tree.
// ---------------------------------------------------------------------------

const scratch = (label: string): string => mkdtempSync(join(tmpdir(), `cuatro-fonts-${label}-`));

/**
 * A complete, correct copy of both build inputs and of the published folder,
 * ready to be corrupted one field at a time. Copying rather than mutating the
 * real tree is what lets every refusal have a standing case instead of a
 * one-time probe.
 */
const scratchTree = (label: string): { source: string; output: string; root: string } => {
  const root = scratch(label);
  const source = join(root, 'source');
  const output = join(root, 'output');
  mkdirSync(source, { recursive: true });
  mkdirSync(output, { recursive: true });
  writeFileSync(join(source, 'faces.json'), readFileSync(FACES_JSON));
  writeFileSync(join(source, 'fallback-metrics.json'), readFileSync(METRICS_JSON));
  cpSync(FACE_DIR, join(output, 'fonts'), { recursive: true });
  return { source, output, root };
};

const runBuild = (environment: Record<string, string | undefined>) => {
  const child = { ...process.env, ...environment };
  for (const [name, value] of Object.entries(environment)) {
    if (value === undefined) delete child[name];
  }
  // `timeout` on the spawn itself, not only on the Vitest case. `spawnSync`
  // blocks the worker thread, so Vitest's per-case budget cannot interrupt it.
  return spawnSync(process.execPath, [BUILD], { encoding: 'utf8', env: child, timeout: SPAWN_TIMEOUT });
};

const rewrite = (file: string, mutate: (value: any) => void): void => {
  const value = JSON.parse(readFileSync(file, 'utf8'));
  mutate(value);
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};

/**
 * Runs the generator against a scratch tree that one mutation has corrupted,
 * and returns what it said. Every refusal case goes through this, so a
 * generator that has quietly stopped refusing shows up as a green build here
 * rather than as a broken contract in seven repositories.
 */
const refusalFrom = (
  label: string,
  corrupt: (paths: { source: string; output: string }) => void
): { status: number | null; stderr: string; wrote: boolean } => {
  const tree = scratchTree(label);
  try {
    corrupt(tree);
    const result = runBuild({ CUATRO_FONTS_SOURCE: tree.source, CUATRO_FONTS_OUTPUT: tree.output });
    return {
      status: result.status,
      stderr: `${result.stderr}${result.stdout}`,
      wrote: existsSync(join(tree.output, 'fonts.css')),
    };
  } finally {
    rmSync(tree.root, { recursive: true, force: true });
  }
};

// ---------------------------------------------------------------------------
// Matrix row 1: build from source, output rewritten byte-identically, twice.
// ---------------------------------------------------------------------------

describe('building from source', () => {
  it(
    'reproduces the committed stylesheet byte for byte, twice in a row, so it is never hand-maintained',
    () => {
      const tree = scratchTree('build');
      try {
        for (const pass of [1, 2]) {
          const result = runBuild({ CUATRO_FONTS_SOURCE: tree.source, CUATRO_FONTS_OUTPUT: tree.output });
          expect(result.status, `pass ${pass}: ${result.stderr}`).toBe(0);
          expect(readFileSync(join(tree.output, 'fonts.css'), 'utf8'), `pass ${pass} differs`).toBe(css);
        }
      } finally {
        rmSync(tree.root, { recursive: true, force: true });
      }
    },
    SPAWN_TIMEOUT
  );

  it(
    'prints both resolved paths, so a redirected run says so in the job log',
    () => {
      const tree = scratchTree('paths');
      try {
        const result = runBuild({ CUATRO_FONTS_SOURCE: tree.source, CUATRO_FONTS_OUTPUT: tree.output });
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).toContain(tree.source.replace(/\\/g, '/'));
        expect(result.stdout).toContain(tree.output.replace(/\\/g, '/'));
      } finally {
        rmSync(tree.root, { recursive: true, force: true });
      }
    },
    SPAWN_TIMEOUT
  );

  it(
    'defaults its source to packages/fonts when CUATRO_FONTS_SOURCE is unset',
    () => {
      const output = scratch('default-source');
      try {
        cpSync(FACE_DIR, join(output, 'fonts'), { recursive: true });
        const result = runBuild({ CUATRO_FONTS_SOURCE: undefined, CUATRO_FONTS_OUTPUT: output });
        expect(result.status, result.stderr).toBe(0);
        expect(readFileSync(join(output, 'fonts.css'), 'utf8')).toBe(css);
      } finally {
        rmSync(output, { recursive: true, force: true });
      }
    },
    SPAWN_TIMEOUT
  );

  it(
    'defaults its output to contracts/fonts.css when CUATRO_FONTS_OUTPUT is unset',
    () => {
      const source = scratch('default-output');
      try {
        writeFileSync(join(source, 'faces.json'), readFileSync(FACES_JSON));
        writeFileSync(join(source, 'fallback-metrics.json'), readFileSync(METRICS_JSON));
        const result = runBuild({ CUATRO_FONTS_SOURCE: source, CUATRO_FONTS_OUTPUT: undefined });
        expect(result.status, result.stderr).toBe(0);
        // The default target is the published file itself. If a regression ever
        // makes this write something else, restore the committed bytes rather
        // than only reporting that it did.
        const after = readFileSync(PUBLISHED, 'utf8');
        if (after !== css) writeFileSync(PUBLISHED, css);
        expect(after).toBe(css);
      } finally {
        rmSync(source, { recursive: true, force: true });
      }
    },
    SPAWN_TIMEOUT
  );
});

// ---------------------------------------------------------------------------
// Matrix row 2: an input edited without a rebuild is what the CI gate sees.
// ---------------------------------------------------------------------------

describe('an input edited without a rebuild', () => {
  it(
    'produces a stylesheet that differs from the committed one, so the drift gate has something to print',
    () => {
      const result = refusalFrom('drift', ({ source }) => {
        rewrite(join(source, 'fallback-metrics.json'), (value) => {
          value.families['Geist'].fallback.ascent += 5;
        });
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.wrote).toBe(true);
    },
    SPAWN_TIMEOUT
  );

  it(
    'changes the published ascent-override when the measured fallback ascent moves',
    () => {
      const tree = scratchTree('drift-value');
      try {
        rewrite(join(tree.source, 'fallback-metrics.json'), (value) => {
          value.families['Geist'].fallback.ascent += 5;
        });
        const result = runBuild({ CUATRO_FONTS_SOURCE: tree.source, CUATRO_FONTS_OUTPUT: tree.output });
        expect(result.status, result.stderr).toBe(0);
        const rebuilt = readFileSync(join(tree.output, 'fonts.css'), 'utf8');
        expect(rebuilt).not.toBe(css);
        const before = ruleFor('Geist').descriptors.get('ascent-override');
        const after = rulesIn(stripComments(rebuilt))
          .rules.find((rule) => rule.descriptors.get('font-family') === '"Geist"')
          ?.descriptors.get('ascent-override');
        expect(after, 'the rebuilt file carries the same ascent-override as the committed one').not.toBe(before);
      } finally {
        rmSync(tree.root, { recursive: true, force: true });
      }
    },
    SPAWN_TIMEOUT
  );
});

// ---------------------------------------------------------------------------
// Matrix row 3: a face binary changed without rerunning prepare.
// ---------------------------------------------------------------------------

describe('a face binary that is not the one the metrics describe', () => {
  it('names the file and both sha256 values, because size alone never decides it', () => {
    const result = refusalFrom('binary', ({ output }) => {
      const target = join(output, 'fonts', faces.faces[0].file);
      const bytes = readFileSync(target);
      // One byte flipped in the middle, so the file is exactly as long as it
      // was. A check that compared sizes would pass over this.
      bytes[Math.floor(bytes.length / 2)] ^= 0xff;
      writeFileSync(target, bytes);
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(faces.faces[0].file);
    expect(result.stderr).toContain(faces.faces[0].sha256);
    expect(result.wrote).toBe(false);
  }, SPAWN_TIMEOUT);

  it('pins every committed face to the sha256 faces.json records for it', () => {
    for (const face of faces.faces) {
      const observed = createHash('sha256').update(readFileSync(join(FACE_DIR, face.file))).digest('hex');
      expect(observed, `contracts/fonts/${face.file} is not the binary faces.json describes`).toBe(face.sha256);
    }
  });

  it('pins every committed licence to the sha256 faces.json records for it', () => {
    for (const face of faces.faces) {
      const observed = createHash('sha256')
        .update(readFileSync(join(FACE_DIR, face.licenceFile), 'utf8').replace(/\r\n/g, '\n'))
        .digest('hex');
      expect(observed, `contracts/fonts/${face.licenceFile} is not the text faces.json describes`).toBe(
        face.licenceSha256
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Matrix row 4: a face named in the CSS is absent.
// ---------------------------------------------------------------------------

describe('a face named by faces.json that is not on disk', () => {
  it('refuses before writing, naming the missing file', () => {
    const result = refusalFrom('missing-face', ({ output }) => {
      rmSync(join(output, 'fonts', faces.faces[2].file));
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(faces.faces[2].file);
    expect(result.wrote, 'a stylesheet was published pointing at a file that is not there').toBe(false);
  }, SPAWN_TIMEOUT);

  it('refuses when the licence beside a face is absent, because the OFL travels with the binary', () => {
    const result = refusalFrom('missing-licence', ({ output }) => {
      rmSync(join(output, 'fonts', faces.faces[0].licenceFile));
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(faces.faces[0].licenceFile);
    expect(result.wrote).toBe(false);
  }, SPAWN_TIMEOUT);
});

// ---------------------------------------------------------------------------
// Matrix row 5: a family missing from either input.
// ---------------------------------------------------------------------------

describe('a family missing from an input', () => {
  it('refuses naming the family and the input file rather than emitting a face with no overrides', () => {
    const result = refusalFrom('missing-metrics', ({ source }) => {
      rewrite(join(source, 'fallback-metrics.json'), (value) => {
        delete value.families['Geist Mono'];
      });
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Geist Mono');
    expect(result.stderr).toContain('fallback-metrics.json');
    expect(result.wrote).toBe(false);
  }, SPAWN_TIMEOUT);

  it('refuses when a measurement is zero, because every descriptor is a ratio of these', () => {
    const result = refusalFrom('zero-metric', ({ source }) => {
      rewrite(join(source, 'fallback-metrics.json'), (value) => {
        value.families['Geist'].face.advance = 0;
      });
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Geist');
    expect(result.wrote).toBe(false);
  }, SPAWN_TIMEOUT);

  it('refuses when the pixel size every override is divided by is missing', () => {
    const result = refusalFrom('no-pixel-size', ({ source }) => {
      rewrite(join(source, 'fallback-metrics.json'), (value) => {
        delete value.provenance.pixelSize;
      });
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('pixelSize');
    expect(result.wrote).toBe(false);
  }, SPAWN_TIMEOUT);

  it('refuses an empty faces.json rather than publishing an empty contract', () => {
    const result = refusalFrom('no-faces', ({ source }) => {
      rewrite(join(source, 'faces.json'), (value) => {
        value.faces = [];
      });
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('faces.json');
    expect(result.wrote).toBe(false);
  }, SPAWN_TIMEOUT);

  it('refuses when an input file is absent altogether', () => {
    const result = refusalFrom('no-input', ({ source }) => {
      rmSync(join(source, 'fallback-metrics.json'));
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('fallback-metrics.json');
    expect(result.wrote).toBe(false);
  }, SPAWN_TIMEOUT);

  it('refuses when faces.json names no licence for a face', () => {
    const result = refusalFrom('no-licence-name', ({ source }) => {
      rewrite(join(source, 'faces.json'), (value) => {
        delete value.faces[1].licence;
      });
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(faces.faces[1].family);
    expect(result.wrote).toBe(false);
  }, SPAWN_TIMEOUT);
});

// ---------------------------------------------------------------------------
// Matrix row 6: a rooted or absolute url() reaches the emitter.
// ---------------------------------------------------------------------------

describe('a url() that is not relative to the stylesheet', () => {
  it('refuses a rooted path, naming the rule', () => {
    const result = refusalFrom('rooted-url', ({ source }) => {
      rewrite(join(source, 'faces.json'), (value) => {
        value.faces[0].file = '/fonts/bricolage-grotesque-latin.woff2';
      });
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(faces.faces[0].family);
    expect(result.stderr).toContain('/fonts/bricolage-grotesque-latin.woff2');
    expect(result.wrote).toBe(false);
  }, SPAWN_TIMEOUT);

  it('refuses a scheme, naming the rule', () => {
    const result = refusalFrom('scheme-url', ({ source }) => {
      rewrite(join(source, 'faces.json'), (value) => {
        value.faces[0].file = 'https://cdn.example.com/x.woff2';
      });
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(faces.faces[0].family);
    expect(result.wrote).toBe(false);
  }, SPAWN_TIMEOUT);

  it('refuses a parent-directory escape, naming the rule', () => {
    const result = refusalFrom('escape-url', ({ source }) => {
      rewrite(join(source, 'faces.json'), (value) => {
        value.faces[0].file = '../fonts/x.woff2';
      });
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(faces.faces[0].family);
    expect(result.wrote).toBe(false);
  }, SPAWN_TIMEOUT);

  it('publishes only urls that start ./fonts/, with no slash and no scheme', () => {
    const urls = [...css.matchAll(/url\(\s*"([^"]*)"\s*\)/g)].map((match) => match[1]);
    expect(urls, 'the published file declares no url() at all').toHaveLength(faces.faces.length);
    for (const url of urls) {
      expect(url, `${url} is not relative to fonts.css`).toMatch(/^\.\/fonts\/[A-Za-z0-9._-]+\.woff2$/);
      expect(url.startsWith('/'), `${url} begins with a slash`).toBe(false);
      expect(/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url), `${url} carries a scheme`).toBe(false);
      expect(url.includes('..'), `${url} escapes the folder`).toBe(false);
    }
  });

  it('publishes a url() for every committed face and a committed face for every url()', () => {
    const urls = [...css.matchAll(/url\(\s*"([^"]*)"\s*\)/g)].map((match) => match[1].replace('./fonts/', ''));
    expect([...urls].sort()).toEqual(faces.faces.map((face) => face.file).sort());
    for (const url of urls) {
      expect(existsSync(join(FACE_DIR, url)), `contracts/fonts/${url} is named by fonts.css and is not there`).toBe(
        true
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Matrix row 9: the budget.
// ---------------------------------------------------------------------------

describe("UX-DR7's asset budget", () => {
  const total = faces.faces.reduce((sum, face) => sum + face.bytes, 0);
  const observedBytes = faces.faces.map((face) => statSync(join(FACE_DIR, face.file)).size);
  const observedTotal = observedBytes.reduce((sum, size) => sum + size, 0);
  const gzipTotal = faces.faces.reduce(
    (sum, face) => sum + gzipSync(readFileSync(join(FACE_DIR, face.file)), { level: 9 }).length,
    0
  );

  const printed = () =>
    faces.faces
      .map((face, index) => `${face.file}: ${observedBytes[index]} bytes on disk, ${face.gzipBytes} gzipped`)
      .concat(`total: ${observedTotal} bytes on disk, ${gzipTotal} gzipped, budget ${faces.budgetBytes}`)
      .join('\n');

  it('holds the three published faces at or below the budget, on disk', () => {
    expect(observedTotal, printed()).toBeLessThanOrEqual(faces.budgetBytes);
  });

  it('holds the three published faces at or below the budget, gzipped, which is the figure UX-DR7 names', () => {
    // woff2 is already brotli-compressed, so gzip adds a few dozen bytes rather
    // than removing any. The gzipped figure is therefore the larger of the two
    // here, and it is the one the requirement names, so it is asserted rather
    // than assumed to follow from the on-disk one.
    expect(gzipTotal, printed()).toBeLessThanOrEqual(faces.budgetBytes);
  });

  it('records per-file figures that match the bytes actually on disk, never rounded down to pass', () => {
    faces.faces.forEach((face, index) => {
      expect(observedBytes[index], `${face.file}: faces.json records ${face.bytes}`).toBe(face.bytes);
    });
    expect(observedTotal, printed()).toBe(total);
    expect(faces.totalBytes).toBe(total);
  });

  it('refuses to publish when the recorded faces would exceed the budget', () => {
    const result = refusalFrom('over-budget', ({ source }) => {
      rewrite(join(source, 'faces.json'), (value) => {
        value.budgetBytes = 1;
      });
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('budget');
    expect(result.wrote).toBe(false);
  }, SPAWN_TIMEOUT);
});

// ---------------------------------------------------------------------------
// Matrix row 10: the header version AD-16 reads estate-wide.
// ---------------------------------------------------------------------------

describe('the header AD-16 reads across seven repositories', () => {
  it('carries Contract vX.Y.Z and the version packages/tokens/package.json declares', () => {
    const header = /Contract v(\d+\.\d+\.\d+)/.exec(css);
    expect(header, 'the file header carries no "Contract vX.Y.Z" line for AD-16 to read').not.toBeNull();
    expect(header?.[1], `the header and packages/tokens/package.json disagree`).toBe(packageVersion);
  });

  it('carries the same version as contracts/tokens.css, because the folder is one contract', () => {
    const here = /Contract v(\d+\.\d+\.\d+)/.exec(css)?.[1];
    const there = /Contract v(\d+\.\d+\.\d+)/.exec(tokensCss)?.[1];
    expect(here, 'fonts.css and tokens.css publish different contract versions').toBe(there);
  });

  it('states the versioning rule the design fixes', () => {
    expect(css).toContain('MINOR');
    expect(css).toContain('MAJOR');
  });

  it('points a reader at the values file and at the licences', () => {
    expect(css).toContain('tokens.css');
    expect(css).toContain('./fonts/');
  });
});

// ---------------------------------------------------------------------------
// The family names, which come from the published tokens file byte for byte.
// ---------------------------------------------------------------------------

describe('the three family names', () => {
  const expected = [
    ['--f-display', 'Bricolage Grotesque'],
    ['--f-body', 'Geist'],
    ['--f-mono', 'Geist Mono'],
  ] as const;

  it.each(expected)('%s leads with %s in contracts/tokens.css', (token, family) => {
    expect(leadingFamily(token)).toBe(family);
  });

  it.each(expected)('%s has an @font-face whose family equals it byte for byte', (token, family) => {
    expect(ruleFor(family).descriptors.get('font-family')).toBe(`"${leadingFamily(token)}"`);
  });

  it('declares exactly three faces and no more', () => {
    expect(fontFaceRules).toHaveLength(3);
    expect(parsed.rules).toHaveLength(3);
    // `outside` holds the rule preludes as well as anything between rules, so
    // the assertion is that nothing outside a brace looks like a declaration.
    // Everything after an unclosed brace would land here, which is the case a
    // regex over the whole file cannot see.
    expect(parsed.outside.replace(/@font-face/g, '').trim(), 'something is declared outside every rule').toBe('');
  });

  it('declares one face per family in faces.json and nothing else', () => {
    expect(fontFaceRules.map((rule) => rule.descriptors.get('font-family')).sort()).toEqual(
      faces.faces.map((face) => `"${face.family}"`).sort()
    );
  });
});

// ---------------------------------------------------------------------------
// The swap descriptors, derived rather than hand-tuned.
// ---------------------------------------------------------------------------

describe('the swap descriptors', () => {
  const percent = (ratio: number): string => `${(ratio * 100).toFixed(3).replace(/\.?0+$/, '')}%`;

  it.each(faces.faces.map((face) => [face.family] as const))('%s carries font-display: swap', (family) => {
    expect(ruleFor(family).descriptors.get('font-display')).toBe('swap');
  });

  it.each(faces.faces.map((face) => [face.family] as const))(
    '%s carries size-adjust, ascent-override and descent-override derived from the measured fallback',
    (family) => {
      const rule = ruleFor(family);
      const measured = metrics.families[family];
      const sizeAdjust = measured.fallback.advance / measured.face.advance;
      const adjustedEm = metrics.provenance.pixelSize * sizeAdjust;

      expect(rule.descriptors.get('size-adjust')).toBe(percent(sizeAdjust));
      expect(rule.descriptors.get('ascent-override')).toBe(percent(measured.fallback.ascent / adjustedEm));
      expect(rule.descriptors.get('descent-override')).toBe(percent(measured.fallback.descent / adjustedEm));
    }
  );

  it.each(faces.faces.map((face) => [face.family] as const))(
    '%s carries line-gap-override exactly when the measured fallback has a line gap',
    (family) => {
      const rule = ruleFor(family);
      const measured = metrics.families[family];
      const sizeAdjust = measured.fallback.advance / measured.face.advance;
      const adjustedEm = metrics.provenance.pixelSize * sizeAdjust;
      if (measured.fallback.lineGap > 0) {
        expect(rule.descriptors.get('line-gap-override')).toBe(percent(measured.fallback.lineGap / adjustedEm));
      } else {
        expect(rule.descriptors.has('line-gap-override')).toBe(false);
      }
    }
  );

  it('tunes each face against the remainder of its own --f-* stack, not against another', () => {
    for (const face of faces.faces) {
      const measured = metrics.families[face.family];
      const stack = /(--f-[a-z]+)\s*:\s*([^;]+);/g;
      const declared = new Map<string, string>();
      for (const match of tokensCss.matchAll(stack)) declared.set(match[1], match[2].trim());
      const rest = declared
        .get(measured.token)!
        .split(',')
        .map((part) => part.trim())
        .slice(1)
        .join(', ');
      expect(measured.fallbackStack, `${face.family} was measured against the wrong stack`).toBe(rest);
    }
  });

  it('declares the axes the instancer actually left in each face', () => {
    for (const face of faces.faces) {
      const rule = ruleFor(face.family);
      const weight = face.axisLimits.wght;
      expect(rule.descriptors.get('font-weight')).toBe(
        Array.isArray(weight) ? `${weight[0]} ${weight[1]}` : `${weight}`
      );
      if (face.axisLimits.wdth) {
        const width = face.axisLimits.wdth as number[];
        expect(rule.descriptors.get('font-stretch')).toBe(`${width[0]}% ${width[1]}%`);
      } else {
        expect(rule.descriptors.has('font-stretch')).toBe(false);
      }
      // What `fvar` still declares has to agree with what the rule claims, or
      // the contract advertises an axis the binary cannot honour.
      for (const [axis, range] of Object.entries(face.axes)) {
        const limit = face.axisLimits[axis];
        expect(Array.isArray(limit) ? [limit[0], limit[1]] : [limit, limit], `${face.family} axis ${axis}`).toEqual([
          range[0],
          range[2],
        ]);
      }
    }
  });

  it('subsets every face to the one pinned latin range', () => {
    for (const face of faces.faces) {
      expect(face.unicodeRange).toBe(faces.faces[0].unicodeRange);
      const declared = ruleFor(face.family).descriptors.get('unicode-range');
      expect(declared?.replace(/,\s+/g, ',')).toBe(face.unicodeRange);
      // Latin only: nothing above the general-punctuation and symbol tail the
      // range names, and no CJK, Cyrillic or Greek block.
      expect(declared).not.toMatch(/U\+0[34][0-9A-F]{2}-/);
      expect(declared).not.toContain('U+4E00');
    }
  });
});

// ---------------------------------------------------------------------------
// The published surface itself: what is there, and what may never be.
// ---------------------------------------------------------------------------

describe('the published surface', () => {
  it('ships exactly the files this contract publishes, and no executable one', () => {
    const published = filesUnder(CONTRACTS).map(repoRelative).sort();
    expect(published).toEqual([
      'contracts/fonts.css',
      'contracts/fonts/OFL-bricolage-grotesque.txt',
      'contracts/fonts/OFL-geist-mono.txt',
      'contracts/fonts/OFL-geist.txt',
      'contracts/fonts/bricolage-grotesque-latin.woff2',
      'contracts/fonts/geist-latin.woff2',
      'contracts/fonts/geist-mono-latin.woff2',
      'contracts/tailwind.css',
      'contracts/tokens.css',
    ]);
    for (const file of published) {
      expect(file, `${file} is executable and contracts/ is the published surface (AD-1)`).not.toMatch(EXECUTABLE);
    }
  });

  it('keeps every generator file under packages/fonts', () => {
    const generators = ['build.mjs', 'prepare.mjs', 'measure.mjs', 'subset.py', 'sources.json', 'faces.json'];
    for (const file of generators) {
      expect(existsSync(join(PACKAGE_ROOT, file)), `packages/fonts/${file} is missing`).toBe(true);
      expect(existsSync(join(CONTRACTS, file)), `${file} reached the published surface`).toBe(false);
    }
  });

  it('carries no package.json, so packages/fonts is not a workspace importer', () => {
    // A manifest here would change the lockfile and oblige a new COPY line in
    // the Docker deps stage, which is the failure
    // `docker/__tests__/deps-stage.test.ts` was written for. See
    // `ops/font-contract.md`, "Why the generator carries no manifest".
    expect(existsSync(join(PACKAGE_ROOT, 'package.json'))).toBe(false);
  });

  it('ships each family its OFL licence text beside its face', () => {
    for (const face of faces.faces) {
      const licence = readFileSync(join(FACE_DIR, face.licenceFile), 'utf8');
      expect(licence, `${face.licenceFile} carries no copyright notice`).toMatch(/Copyright/i);
      expect(licence, `${face.licenceFile} is not the OFL`).toContain('SIL OPEN FONT LICENSE');
      expect(face.licence).toBe('SIL Open Font License 1.1');
    }
  });

  it('uses LF endings and exactly one trailing newline', () => {
    expect(css.includes('\r'), 'contracts/fonts.css carries a CR').toBe(false);
    expect(css.endsWith('\n')).toBe(true);
    expect(css.endsWith('\n\n')).toBe(false);
    for (const face of faces.faces) {
      const licence = readFileSync(join(FACE_DIR, face.licenceFile), 'utf8');
      expect(licence.includes('\r'), `contracts/fonts/${face.licenceFile} carries a CR`).toBe(false);
    }
  });

  it('declares no @import, so a vendored folder pulls in nothing it did not copy', () => {
    expect(css).not.toContain('@import');
  });

  it('leaves contracts/tokens.css carrying no @font-face and no url()', () => {
    expect(tokensCss).not.toContain('@font-face');
    expect(tokensCss).not.toContain('url(');
  });
});
