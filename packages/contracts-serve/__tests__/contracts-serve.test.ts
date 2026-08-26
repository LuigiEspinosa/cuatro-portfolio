// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { publish, main, SOURCE, DESTINATION, SERVED_AT } from '../publish.mjs';

// One standing case per row of Story 1-16's I/O matrix, plus one per refusal
// the publish makes that no matrix row names, plus the working tree's own
// obligations: the `build` script's content and ordering, the `.gitignore`
// entry, and that nothing under `public/contracts` is tracked.
//
// This suite rides the already-blocking `test` job. No new CI job was added by
// this story: the publish runs inside `pnpm build`, which the `rendered-output`
// job already executes through the Playwright harness, and the served result is
// asserted there by `tests/e2e/contract-serving.pw.ts`.

// Resolved from the repository root, which is where Vitest runs. Not from
// `import.meta.url`: under Vitest that is a vite URL rather than a `file:` one,
// so neither `new URL(...)` nor `fileURLToPath` works here. Same treatment as
// `ops/__tests__/contract-purity.test.ts`.
const REPO_ROOT = process.cwd();
const SCRIPT = resolve(REPO_ROOT, 'packages/contracts-serve/publish.mjs');
const MANIFEST = resolve(REPO_ROOT, 'package.json');
const GITIGNORE = resolve(REPO_ROOT, '.gitignore');
const BROWSER_SPEC = resolve(REPO_ROOT, 'tests/e2e/contract-serving.pw.ts');
const HERE = 'packages/contracts-serve/__tests__/contracts-serve.test.ts';

/** The ignore rule, written once. Every case below reads this rather than a second literal. */
const IGNORED_PATH = '/public/contracts/';

/** What the publish step is spelled as wherever a script runs it. */
const PUBLISH_COMMAND = 'node packages/contracts-serve/publish.mjs';

/** What it must precede in `build`. */
const NEXT_BUILD = 'next build';

// Work done at collection time fails the whole file rather than one case, and a
// bare ENOENT there says nothing about what this suite wanted.
const atCollection = <T>(why: string, build: () => T): T => {
  try {
    return build();
  } catch (error) {
    throw new Error(`${HERE}: ${why} ${error instanceof Error ? error.message : String(error)}`);
  }
};

// `spawnSync` reports a failure to start in `error` and leaves `status` null,
// so an unguarded `run.status` turns a broken harness into what reads as a
// defect in the thing under test.
const spawned = <T>(run: SpawnSyncReturns<T>): SpawnSyncReturns<T> => {
  if (run.error) throw run.error;
  return run;
};

// Every case builds its own tree under `tmpdir()`, so neither the committed
// `contracts/` nor the real `public/contracts/` is touched by a test run, and a
// killed run leaves nothing under the repository.
const withRoot = <T>(use: (root: string) => T): T => {
  const root = mkdtempSync(join(tmpdir(), 'contracts-serve-'));
  try {
    return use(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

/** A scratch surface named `contracts` under `root`, carrying `files` with distinguishable bytes. */
const surfaceWith = (root: string, files: Record<string, string>): string => {
  const surface = join(root, 'contracts');
  mkdirSync(surface, { recursive: true });
  for (const [file, contents] of Object.entries(files)) {
    const full = join(surface, ...file.split('/'));
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents, 'utf8');
  }
  return surface;
};

/** A scratch destination. Named `contracts` because the publish refuses any other final segment. */
const destinationIn = (root: string): string => join(root, 'public', 'contracts');

/** Every file under `directory`, as sorted relative paths with forward slashes. */
const treeOf = (directory: string, prefix = '', found: string[] = []): string[] => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) treeOf(join(directory, entry.name), `${prefix}${entry.name}/`, found);
    else found.push(`${prefix}${entry.name}`);
  }
  found.sort();
  return found;
};

const refusalFrom = (act: () => unknown): string => {
  try {
    act();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error(`${HERE}: the publish was expected to refuse and did not.`);
};

// A link to a directory. `junction` is a Windows notion and is ignored on
// POSIX, where this makes an ordinary symbolic link, so one call covers both
// hosts and needs no privilege on either. Same helper
// `ops/__tests__/contract-purity.test.ts:86-94` uses.
const linkDirectory = (target: string, path: string): void => symlinkSync(target, path, 'junction');

// A link at `name` under the surface. The first branch is what the refusal
// actually describes, a link to a file outside the folder. Windows refuses a
// file symlink without Developer Mode or elevation, and a case that quietly
// skips itself on the host where the published folder is authored is the
// failure this file exists to prevent, so the fallback exercises a directory
// junction instead: a weaker fixture for the same refusal, since the walk
// refuses on `isSymbolicLink()` alone. It points at a dedicated empty directory
// and never at the tree being walked, so teardown removes the link rather than
// reaching through it.
const linkAt = (surface: string, name: string, target: string): void => {
  try {
    symlinkSync(target, join(surface, name), 'file');
  } catch {
    const fallback = join(dirname(target), 'junction-target');
    mkdirSync(fallback, { recursive: true });
    linkDirectory(fallback, join(surface, name));
  }
};

// A directory listing that never touches a filesystem, and a host built around
// it. One of the publish's refusals cannot be constructed portably on both a
// Windows authoring host and a Linux runner: an entry that is neither a file
// nor a directory needs `mkfifo`. The reader is injected instead, on the
// `inspect(directory, read)` precedent in `ops/contract-purity.mjs`. It decides
// how a directory is listed, never which directory is read.
type FakeEntry = { name: string; isSymbolicLink(): boolean; isDirectory(): boolean; isFile(): boolean };
const entry = (name: string, kind: 'file' | 'directory' | 'link' | 'other'): FakeEntry => ({
  name,
  isSymbolicLink: () => kind === 'link',
  isDirectory: () => kind === 'directory',
  isFile: () => kind === 'file',
});

const failing = (code: string, message: string) => {
  const error: NodeJS.ErrnoException = new Error(message);
  error.code = code;
  return error;
};

/**
 * The real host, with individual operations replaced. The publish takes one so
 * the two failure paths no portable filesystem state can arrange, a removal
 * that will not remove and a copy that fails part way through, each get a
 * standing case instead of a comment. The defaults are the real operations, so
 * a case that overrides `copy` still exercises the real walk and removal.
 */
type Host = {
  read: (directory: string) => FakeEntry[];
  remove: (path: string) => void;
  copy: (from: string, to: string) => void;
};

const hostWith = (overrides: Partial<Host> = {}): Host => ({
  read: (directory) => readdirSync(directory, { withFileTypes: true }),
  remove: (path) => rmSync(path, { recursive: true, force: true }),
  copy: (from, to) => {
    writeFileSync(to, readFileSync(from));
  },
  ...overrides,
});

const THREE_FILES = {
  'tokens.css': ':root { --token-bg: black; }\n',
  'fonts.css': '@font-face { font-family: "Geist"; }\n',
  'fonts/geist-latin.woff2': 'not really a font, but its own bytes\n',
};

// ---------------------------------------------------------------------------
// Matrix row "Served copy equals the authored one".
// ---------------------------------------------------------------------------

describe('the publish', () => {
  it('writes the same relative file list as the source, byte for byte', () => {
    withRoot((root) => {
      const source = surfaceWith(root, THREE_FILES);
      const destination = destinationIn(root);

      const written = publish(source, destination);

      expect(written).toEqual(['fonts.css', 'fonts/geist-latin.woff2', 'tokens.css']);
      expect(treeOf(destination), 'the served tree is not the same file list as the source').toEqual(treeOf(source));
      for (const file of written) {
        const parts = file.split('/');
        expect(
          readFileSync(join(destination, ...parts)).equals(readFileSync(join(source, ...parts))),
          `${file} is not byte-identical to the authored file, so the copy is lossy or partial`
        ).toBe(true);
      }
    });
  });

  it('creates the destination even when its parent does not exist yet', () => {
    withRoot((root) => {
      const source = surfaceWith(root, THREE_FILES);
      const destination = join(root, 'not', 'made', 'yet', 'contracts');
      publish(source, destination);
      expect(treeOf(destination)).toEqual(treeOf(source));
    });
  });

  // -------------------------------------------------------------------------
  // Matrix row "Stale copy".
  // -------------------------------------------------------------------------

  it('removes a file the source no longer has, rather than leaving it served', () => {
    withRoot((root) => {
      const source = surfaceWith(root, THREE_FILES);
      const destination = destinationIn(root);

      publish(source, destination);

      // A contract file that was renamed or deleted at source, plus a stale
      // nested one, plus a stale copy of a file that still exists.
      writeFileSync(join(destination, 'registry.json'), '{"retired": true}\n', 'utf8');
      mkdirSync(join(destination, 'fonts'), { recursive: true });
      writeFileSync(join(destination, 'fonts', 'monument-latin.woff2'), 'a face nobody publishes\n', 'utf8');
      writeFileSync(join(destination, 'tokens.css'), ':root { --token-bg: WRONG; }\n', 'utf8');

      publish(source, destination);

      expect(
        treeOf(destination),
        'a file the source does not carry survived the publish, so a renamed or deleted contract would still be served'
      ).toEqual(treeOf(source));
      expect(
        readFileSync(join(destination, 'tokens.css'), 'utf8'),
        'a stale copy of a file that still exists was not overwritten'
      ).toBe(THREE_FILES['tokens.css']);
    });
  });

  it('removes a stale directory the source no longer has at all', () => {
    withRoot((root) => {
      const source = surfaceWith(root, THREE_FILES);
      const destination = destinationIn(root);
      publish(source, destination);
      mkdirSync(join(destination, 'schemas', 'v1'), { recursive: true });
      writeFileSync(join(destination, 'schemas', 'v1', 'registry.schema.json'), '{}\n', 'utf8');

      publish(source, destination);

      expect(treeOf(destination)).toEqual(treeOf(source));
    });
  });
});

// ---------------------------------------------------------------------------
// Matrix row "Missing source", and the refusals beside it.
// ---------------------------------------------------------------------------

describe('the publish refuses', () => {
  it('a missing source, naming the path and publishing nothing', () => {
    withRoot((root) => {
      const destination = destinationIn(root);
      const message = refusalFrom(() => publish(join(root, 'contracts'), destination));
      expect(message).toContain('contracts');
      expect(message).toContain('ENOENT');
      expect(message).toContain('Nothing was published.');
      // The half that matters. A silent empty publish would serve 404s from a
      // green build, so the destination must not exist afterwards either.
      expect(
        () => statSync(destination),
        'the refusal left a destination behind, so a green build would serve an empty /contracts/'
      ).toThrow();
    });
  });

  it('a source that is a file rather than a directory', () => {
    withRoot((root) => {
      const source = join(root, 'contracts');
      writeFileSync(source, 'not a directory\n', 'utf8');
      const message = refusalFrom(() => publish(source, destinationIn(root)));
      expect(message).toContain('not a directory');
      expect(message).toContain('Nothing was published.');
    });
  });

  it('an empty source, saying so rather than publishing an empty served tree', () => {
    withRoot((root) => {
      const source = surfaceWith(root, {});
      const destination = destinationIn(root);
      const message = refusalFrom(() => publish(source, destination));
      expect(message).toContain('holds no files');
      expect(message).toContain(SERVED_AT);
      expect(() => statSync(destination)).toThrow();
    });
  });

  it('a source holding only empty directories, which is the same zero one level down', () => {
    withRoot((root) => {
      const source = surfaceWith(root, {});
      mkdirSync(join(source, 'fonts'), { recursive: true });
      expect(refusalFrom(() => publish(source, destinationIn(root)))).toContain('holds no files');
    });
  });

  it('a destination whose final segment is not "contracts", because it begins by removing it', () => {
    // The publish opens with a recursive removal of a computed path. The guard
    // is what keeps a mistake in that computation from taking the rest of
    // `public/` with it, and a guard with no case is a guard that can be
    // deleted without anything noticing.
    withRoot((root) => {
      const source = surfaceWith(root, THREE_FILES);
      const wrong = join(root, 'public');
      mkdirSync(wrong, { recursive: true });
      writeFileSync(join(wrong, 'logo.png'), 'an unrelated public asset\n', 'utf8');

      const message = refusalFrom(() => publish(source, wrong));
      expect(message).toContain('is not named "contracts"');
      expect(
        readFileSync(join(wrong, 'logo.png'), 'utf8'),
        'the refusal still removed the destination, which is the whole failure the guard exists for'
      ).toContain('unrelated public asset');
    });
  });

  it('a destination that is the source, which would delete the published surface', () => {
    withRoot((root) => {
      const source = surfaceWith(root, THREE_FILES);
      const message = refusalFrom(() => publish(source, source));
      expect(message).toContain('one contains the other');
      expect(treeOf(source), 'the authored surface was removed by its own publish').toEqual([
        'fonts.css',
        'fonts/geist-latin.woff2',
        'tokens.css',
      ]);
    });
  });

  it('a destination underneath the source, which deletes it just as surely', () => {
    // Equality was the obvious case and the only one the first draft caught.
    // `rmSync(destination, { recursive: true })` on a path inside the source
    // removes part of the published surface before the walk's own list is
    // copied out of it, and the refusal table's wording ("It would delete the
    // published surface") claims to cover this.
    withRoot((root) => {
      const source = surfaceWith(root, THREE_FILES);
      const inside = join(source, 'served', 'contracts');
      const message = refusalFrom(() => publish(source, inside));
      expect(message).toContain('one contains the other');
      expect(treeOf(source), 'the authored surface lost a file to its own publish').toEqual([
        'fonts.css',
        'fonts/geist-latin.woff2',
        'tokens.css',
      ]);
    });
  });

  it('a source underneath the destination, which is the same removal from the other side', () => {
    withRoot((root) => {
      const destination = destinationIn(root);
      const source = surfaceWith(join(destination, 'authored'), THREE_FILES);
      const message = refusalFrom(() => publish(source, destination));
      expect(message).toContain('one contains the other');
      expect(treeOf(source)).toEqual(['fonts.css', 'fonts/geist-latin.woff2', 'tokens.css']);
    });
  });

  it('a surface root that is itself a link, rather than following it', () => {
    withRoot((root) => {
      const elsewhere = join(root, 'elsewhere');
      mkdirSync(elsewhere, { recursive: true });
      writeFileSync(join(elsewhere, 'tokens.css'), ':root {}\n', 'utf8');
      const source = join(root, 'contracts');
      // A host that cannot make this fixture reports that by name. A case that
      // quietly skipped itself would leave the `lstatSync` symlink branch
      // deletable with every case still green, which is what this closes.
      expect(
        () => linkDirectory(elsewhere, source),
        `${HERE}: this host could not create a directory link, so the linked-surface refusal has no fixture`
      ).not.toThrow();
      const message = refusalFrom(() => publish(source, destinationIn(root)));
      expect(message).toContain('is a link');
      expect(message).toContain('must be the committed directory');
    });
  });

  it('a link under the source, because a vendored copy resolves elsewhere or nowhere', () => {
    withRoot((root) => {
      const outside = join(root, 'build.mjs');
      writeFileSync(outside, 'export {};\n', 'utf8');
      const source = surfaceWith(root, THREE_FILES);
      expect(
        () => linkAt(source, 'data.css', outside),
        `${HERE}: this host could not create a link, so the linked-entry refusal has no fixture`
      ).not.toThrow();
      const destination = destinationIn(root);
      const message = refusalFrom(() => publish(source, destination));
      expect(message).toContain('contracts/data.css');
      expect(message).toContain('is a link');
      // The walk refuses before anything is removed or written, so the refusal
      // leaves no served tree at all.
      expect(() => statSync(destination)).toThrow();
    });
  });

  it('an entry that is neither a file nor a directory', () => {
    // A socket or a fifo. Fed through the injected reader rather than through a
    // real filesystem entry, because `mkfifo` has no portable equivalent on the
    // Windows host where the published folder is authored.
    withRoot((root) => {
      const source = surfaceWith(root, THREE_FILES);
      const message = refusalFrom(() =>
        publish(
          source,
          destinationIn(root),
          hostWith({ read: () => [entry('tokens.css', 'file'), entry('socket', 'other')] })
        )
      );
      expect(message).toContain('contracts/socket');
      expect(message).toContain('neither a file nor a directory');
    });
  });

  it('a destination that will not be removed, rather than letting a raw error reach the build log', () => {
    // `rmSync` failing with EPERM or EBUSY, which a locked file or an open
    // handle produces on Windows and no portable call can arrange. Left
    // unguarded it raised an error carrying neither this file's name nor the
    // clause the record states holds for every refusal.
    withRoot((root) => {
      const source = surfaceWith(root, THREE_FILES);
      const destination = destinationIn(root);
      const message = refusalFrom(() =>
        publish(
          source,
          destination,
          hostWith({
            remove: () => {
              throw failing('EBUSY', 'resource busy or locked');
            },
          })
        )
      );
      expect(message).toContain('could not be removed');
      expect(message).toContain('EBUSY');
      expect(message).toContain('packages/contracts-serve/publish.mjs');
      expect(message.endsWith('Nothing was published.')).toBe(true);
      expect(
        () => statSync(destination),
        'the refusal wrote a served tree anyway, after failing to clear the old one'
      ).toThrow();
    });
  });

  it('a copy that fails part way through, and removes what it had already written', () => {
    // ENOSPC or EACCES on file three of nine. A half written served tree is
    // worse than none: it answers 200 for the contract files that made it and
    // 404 for the rest, from a build that exited non-zero somewhere a deploy
    // log may not be read.
    withRoot((root) => {
      const source = surfaceWith(root, THREE_FILES);
      const destination = destinationIn(root);
      let copied = 0;
      const message = refusalFrom(() =>
        publish(
          source,
          destination,
          hostWith({
            copy: (from, to) => {
              copied += 1;
              if (copied === 2) throw failing('ENOSPC', 'no space left on device');
              writeFileSync(to, readFileSync(from));
            },
          })
        )
      );
      expect(copied, 'the fixture never reached the failing copy, so it proves nothing').toBe(2);
      expect(message).toContain('could not be copied');
      expect(message).toContain('ENOSPC');
      expect(message).toContain('The partly written served copy was removed.');
      expect(message.endsWith('Nothing was published.')).toBe(true);
      expect(
        () => statSync(destination),
        'a partly written served tree survived, so /contracts/ would answer 200 for some files and 404 for the rest'
      ).toThrow();
    });
  });

  it('and says so plainly when the partial tree could not be removed either', () => {
    // The one refusal that can leave debris. It names the leftover path rather
    // than claiming a clean failure, which is what makes the clause honest.
    withRoot((root) => {
      const source = surfaceWith(root, THREE_FILES);
      const destination = destinationIn(root);
      let removals = 0;
      const message = refusalFrom(() =>
        publish(
          source,
          destination,
          hostWith({
            remove: (path) => {
              removals += 1;
              // The opening removal succeeds; the cleanup after the failed copy
              // does not, which is the ordering a locked file produces.
              if (removals > 1) throw failing('EPERM', 'operation not permitted');
              rmSync(path, { recursive: true, force: true });
            },
            copy: () => {
              throw failing('EACCES', 'permission denied');
            },
          })
        )
      );
      expect(removals, 'the cleanup removal was never attempted').toBe(2);
      expect(message).toContain('could not be removed either');
      expect(message).toContain('deleted by hand');
      expect(message).toContain('EACCES');
    });
  });
});

describe('every refusal', () => {
  // One fixture per kind of refusal the publish makes, not a sample of them.
  // The block is written as though it enumerates every refusal, because
  // `ops/contract-serving.md` states as a fact that the whole set carries the
  // clause and the script's name. A kind left out of this list is a kind whose
  // message nothing holds: they inherit both through one helper today, and a
  // refusal built without that helper would slip past a list that stopped at
  // five.
  const messages = atCollection('the refusal fixtures could not be built under tmpdir().', () => [
    withRoot((root) => refusalFrom(() => publish(join(root, 'contracts'), destinationIn(root)))),
    withRoot((root) => refusalFrom(() => publish(surfaceWith(root, {}), destinationIn(root)))),
    withRoot((root) => {
      const source = join(root, 'contracts');
      writeFileSync(source, 'not a directory\n', 'utf8');
      return refusalFrom(() => publish(source, destinationIn(root)));
    }),
    withRoot((root) => refusalFrom(() => publish(surfaceWith(root, THREE_FILES), join(root, 'public')))),
    withRoot((root) => {
      const source = surfaceWith(root, THREE_FILES);
      return refusalFrom(() => publish(source, source));
    }),
    withRoot((root) => {
      const elsewhere = join(root, 'elsewhere');
      mkdirSync(elsewhere, { recursive: true });
      writeFileSync(join(elsewhere, 'tokens.css'), ':root {}\n', 'utf8');
      const source = join(root, 'contracts');
      linkDirectory(elsewhere, source);
      return refusalFrom(() => publish(source, destinationIn(root)));
    }),
    withRoot((root) => {
      const outside = join(root, 'build.mjs');
      writeFileSync(outside, 'export {};\n', 'utf8');
      const source = surfaceWith(root, THREE_FILES);
      linkAt(source, 'data.css', outside);
      return refusalFrom(() => publish(source, destinationIn(root)));
    }),
    withRoot((root) =>
      refusalFrom(() =>
        publish(
          surfaceWith(root, THREE_FILES),
          destinationIn(root),
          hostWith({ read: () => [entry('tokens.css', 'file'), entry('socket', 'other')] })
        )
      )
    ),
    withRoot((root) =>
      refusalFrom(() =>
        publish(
          surfaceWith(root, THREE_FILES),
          destinationIn(root),
          hostWith({
            remove: () => {
              throw failing('EBUSY', 'resource busy or locked');
            },
          })
        )
      )
    ),
    withRoot((root) =>
      refusalFrom(() =>
        publish(
          surfaceWith(root, THREE_FILES),
          destinationIn(root),
          hostWith({
            copy: () => {
              throw failing('ENOSPC', 'no space left on device');
            },
          })
        )
      )
    ),
  ]);

  it('carries one fixture per row of the refusal table ops/contract-serving.md publishes', () => {
    // The table has ten numbered rows. Pinning the count is what makes the two
    // lists edited together: it catches this list shrinking, which is how the
    // claim above quietly narrows, and it turns adding an eleventh row to the
    // record into a failing case here rather than an unbacked sentence there.
    // It cannot catch a refusal added to the module and to neither list, which
    // is what review is for.
    expect(messages.length, "the refusal fixture list and the record's table disagree").toBe(10);
  });

  it('ends with the clause that says no publish completed', () => {
    // Appended in one place in the module rather than written out per site, so
    // the claim `ops/contract-serving.md` makes about the whole set cannot
    // drift message by message.
    for (const message of messages) expect(message.endsWith('Nothing was published.')).toBe(true);
  });

  it('names the script, so a build log says which step refused', () => {
    for (const message of messages) expect(message).toContain('packages/contracts-serve/publish.mjs');
  });
});

// ---------------------------------------------------------------------------
// The real entry point, and the paths it fixes.
// ---------------------------------------------------------------------------

describe('the publish as the build runs it', () => {
  it('reads the repository root contracts/ and writes public/contracts/, both fixed', () => {
    expect(SOURCE).toBe(resolve(REPO_ROOT, 'contracts'));
    expect(DESTINATION).toBe(resolve(REPO_ROOT, 'public', 'contracts'));
    expect(SERVED_AT).toBe('/contracts/');
    expect(typeof main, 'main() is the entry point and takes nothing').toBe('function');
    expect(main.length, 'main() takes an argument, so a caller can point the publish somewhere else').toBe(0);
  });

  it('reads no environment variable and no argv position beyond the script path', () => {
    // The generators each needed two build inputs pinned empty in `ci.yml` to
    // stop a runner environment redirecting them. This step has no such input
    // by construction, and that is asserted on the source rather than by
    // guessing at a variable name, so a future variable cannot slip past a case
    // that only knew the old ones.
    const instructions = readFileSync(SCRIPT, 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    expect(instructions).not.toContain('process.env');
    expect(instructions, 'node:process is a route to the environment that spells no "process.env"').not.toMatch(
      /from\s*['"]node:process['"]/
    );
    const argv = [...instructions.matchAll(/process\.argv[^\s,;)]*/g)].map((match) => match[0]);
    expect(argv.length).toBeGreaterThan(0);
    for (const use of argv) expect(use, 'the publish reads an argv position other than the script path').toBe('process.argv[1]');
  });

  it('imports only node builtins, so it adds no dependency to the build', () => {
    // The reason this package carries no `package.json`: a manifest here would
    // make it a workspace importer, change the lockfile, and oblige a new
    // `COPY` line in the Docker `deps` stage that
    // `docker/__tests__/deps-stage.test.ts` polices.
    const source = readFileSync(SCRIPT, 'utf8');
    const specifiers = [...source.matchAll(/^import\s[^'"]*['"]([^'"]+)['"]/gm)].map((match) => match[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) expect(specifier).toMatch(/^node:/);
    const dynamic = [...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
    for (const specifier of dynamic) expect(specifier, 'a dynamic import reaches outside node:').toMatch(/^node:/);
  });

  it('exits non-zero and writes the refusal to stderr when the source is gone', () => {
    // The module resolves both paths at `../..`, so a scratch copy of it two
    // directories below a scratch root exercises the real read, the real
    // removal, the real invoked-directly guard and the real exit code without
    // touching the repository.
    const run = withRoot((root) => {
      const home = join(root, 'packages', 'contracts-serve');
      mkdirSync(home, { recursive: true });
      const copy = join(home, 'publish.mjs');
      writeFileSync(copy, readFileSync(SCRIPT, 'utf8'), 'utf8');
      return { run: spawned(spawnSync(process.execPath, [copy], { encoding: 'utf8' })), root };
    });
    expect(run.run.status).toBe(1);
    expect(run.run.stderr).toContain('Nothing was published.');
    // Both lines, on the refusal path. The module's own comment and the record
    // argue they are load-bearing: a redirected run says which pair it used
    // even when the publish then refuses. Nothing held them before.
    expect(run.run.stdout, 'the refusal printed no "reading" line, so a job log cannot say what it read').toContain(
      'packages/contracts-serve: reading  '
    );
    expect(run.run.stdout, 'the refusal printed no "writing" line').toContain('packages/contracts-serve: writing  ');
  });

  it('exits 0 against a real tree, printing the pair it used and every path it published', () => {
    const run = withRoot((root) => {
      const source = surfaceWith(root, THREE_FILES);
      const home = join(root, 'packages', 'contracts-serve');
      mkdirSync(home, { recursive: true });
      const copy = join(home, 'publish.mjs');
      writeFileSync(copy, readFileSync(SCRIPT, 'utf8'), 'utf8');
      const destination = join(root, 'public', 'contracts');
      const result = spawned(spawnSync(process.execPath, [copy], { encoding: 'utf8' }));
      return { result, tree: treeOf(destination), source, destination };
    });
    expect(run.result.status, `${run.result.stdout}${run.result.stderr}`).toBe(0);
    expect(run.tree).toEqual(['fonts.css', 'fonts/geist-latin.woff2', 'tokens.css']);
    for (const file of run.tree) expect(run.result.stdout).toContain(`${SERVED_AT}${file}`);
    expect(run.result.stdout).toContain('published 3 files');
    // The two paths as printed, forward slashes and all, so the lines a job log
    // carries are the resolved pair rather than a label.
    const posix = (path: string) => path.replace(/\\/g, '/');
    expect(run.result.stdout).toContain(`packages/contracts-serve: reading  ${posix(run.source)}`);
    expect(run.result.stdout).toContain(`packages/contracts-serve: writing  ${posix(run.destination)}`);
  });

  it('recognises itself when invoked through a path that is not the one it resolves to', () => {
    // The invoked-directly guard, exercised on the shape that used to break it.
    // A textual comparison of `process.argv[1]` against the module's own path
    // answers no for a differing drive-letter case, an 8.3 short path or a
    // linked invocation, the publish is skipped, and `pnpm build` exits 0
    // having shipped a site that serves 404s at /contracts/. On Windows the
    // lower-cased drive letter is the cheap, always-available version of that.
    const run = withRoot((root) => {
      surfaceWith(root, THREE_FILES);
      const home = join(root, 'packages', 'contracts-serve');
      mkdirSync(home, { recursive: true });
      const copy = join(home, 'publish.mjs');
      writeFileSync(copy, readFileSync(SCRIPT, 'utf8'), 'utf8');
      const spelled = /^[A-Za-z]:/.test(copy) ? `${copy[0].toLowerCase()}${copy.slice(1)}` : copy;
      const result = spawned(spawnSync(process.execPath, [spelled], { encoding: 'utf8' }));
      return { result, tree: treeOf(join(root, 'public', 'contracts')) };
    });
    expect(run.result.status, `${run.result.stdout}${run.result.stderr}`).toBe(0);
    expect(
      run.tree,
      'the publish ran as a module rather than as a script, copied nothing, and let the build continue'
    ).toEqual(['fonts.css', 'fonts/geist-latin.woff2', 'tokens.css']);
  });

  it('has a real published surface to copy, so the build step is not a no-op waiting to refuse', () => {
    expect(treeOf(SOURCE).length, `${SOURCE} holds no files`).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// The served path, spelled once across the two suites that assert it.
// ---------------------------------------------------------------------------

describe('the served path', () => {
  it('is spelled the same in the browser spec as the module exports it', () => {
    // `tests/e2e/contract-serving.pw.ts` cannot import the module: Playwright
    // transpiles a spec to CommonJS and the repository declares no
    // `"type": "module"`. So it declares the literal, and this is what keeps
    // the two from drifting into `/contracts` and `/contracts/`, which is the
    // exact split the module's own SURFACE comment argues against.
    const spec = atCollection(`${BROWSER_SPEC} could not be read.`, () => readFileSync(BROWSER_SPEC, 'utf8'));
    const declared = /const SERVED_AT = '([^']*)';/.exec(spec);
    expect(declared, 'the browser spec no longer declares a SERVED_AT constant this case can read').toBeTruthy();
    expect(
      declared![1],
      'tests/e2e/contract-serving.pw.ts and packages/contracts-serve/publish.mjs spell the served path differently'
    ).toBe(SERVED_AT);
  });
});

// ---------------------------------------------------------------------------
// Matrix row "Build ordering", with its planted negative.
// ---------------------------------------------------------------------------

describe('the build script', () => {
  const scripts = atCollection(`${MANIFEST} could not be read, and it is the file this block asserts.`, () => {
    const parsed = JSON.parse(readFileSync(MANIFEST, 'utf8')) as { scripts?: Record<string, string> };
    if (!parsed.scripts) throw new Error('it declares no "scripts" block');
    return parsed.scripts;
  });

  /**
   * Why a script is wrong, or `null` when it is right. Written as a function so
   * the same reading is applied to the real script and to the planted negatives
   * below: an assertion nothing is ever observed rejecting is not known to be
   * able to reject.
   *
   * Next reads its public directory when the server starts, so a publish that
   * ran after `next build` would still be too late for the build output and for
   * the Docker runner stage that copies `public`.
   */
  const wrongAbout = (script: string): string | null => {
    const publishes = script.indexOf(PUBLISH_COMMAND);
    const builds = script.indexOf(NEXT_BUILD);
    if (publishes === -1) return `it does not run "${PUBLISH_COMMAND}", so a build would ship nothing at ${SERVED_AT}`;
    if (builds === -1) return `it does not run "${NEXT_BUILD}"`;
    if (publishes > builds) {
      return `it publishes after "${NEXT_BUILD}", and Next reads its public directory when the server starts`;
    }
    return null;
  };

  it('runs the publish step, and runs it before next build', () => {
    expect(wrongAbout(scripts.build ?? ''), `package.json "build" is ${JSON.stringify(scripts.build)}`).toBeNull();
  });

  it('is read by a check that is observed rejecting a wrong script on every run', () => {
    // The planted negative. Three shapes, because each is a different way the
    // ordering rule has actually been broken elsewhere: dropping the step,
    // running it afterwards, and wiring it to a pnpm lifecycle hook that
    // `enable-pre-post-scripts` may not run at all.
    expect(wrongAbout(NEXT_BUILD)).toContain('would ship nothing');
    expect(wrongAbout(`${NEXT_BUILD} && ${PUBLISH_COMMAND}`)).toContain('publishes after');
    expect(wrongAbout(PUBLISH_COMMAND)).toContain(`does not run "${NEXT_BUILD}"`);
  });

  it('wires the publish into build itself rather than into a prebuild hook', () => {
    // `enable-pre-post-scripts` is a pnpm setting this repository does not pin.
    // A `prebuild` script would be silently skipped wherever it is off, and the
    // symptom is a working site serving 404s at /contracts/.
    expect(scripts, 'a prebuild hook is not run unless enable-pre-post-scripts is on').not.toHaveProperty('prebuild');
    expect(scripts.build).toContain(PUBLISH_COMMAND);
  });

  it('publishes for dev too, so every path that starts a server has the served copy in place', () => {
    expect(scripts.dev ?? '', `package.json "dev" is ${JSON.stringify(scripts.dev)}`).toContain(PUBLISH_COMMAND);
    expect((scripts.dev ?? '').indexOf(PUBLISH_COMMAND)).toBeLessThan((scripts.dev ?? '').indexOf('next dev'));
  });

  it('spells the step the same way everywhere it appears', () => {
    // `contracts:publish` is the named script a human runs, on the
    // `packages/<name>/<verb>.mjs` plus `<name>:<verb>` convention
    // `packages/tokens` and `packages/fonts` set. `build` invokes the script
    // file directly rather than nesting a package manager, so the two spellings
    // are pinned equal here and cannot drift into two different steps.
    expect(scripts['contracts:publish']).toBe(PUBLISH_COMMAND);
  });

  it('names a script file that is actually in the tree', () => {
    expect(() => statSync(SCRIPT), 'the build names a publish step that does not exist').not.toThrow();
  });

  it('leaves the other scripts doing what they did', () => {
    expect(scripts.start).toBe('next start');
    expect(scripts['test:e2e']).toBe('playwright test');
    expect(scripts['tokens:build']).toBe('node packages/tokens/build.mjs');
    expect(scripts['fonts:build']).toBe('node packages/fonts/build.mjs');
  });
});

// ---------------------------------------------------------------------------
// Matrix row "No committed copy". AD-4: one authored location.
// ---------------------------------------------------------------------------

describe('the working tree', () => {
  it('ignores the served copy', () => {
    const ignored = atCollection(`${GITIGNORE} could not be read.`, () =>
      readFileSync(GITIGNORE, 'utf8')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => line.trim())
    );
    expect(ignored, `.gitignore does not carry ${IGNORED_PATH}`).toContain(IGNORED_PATH);
  });

  it('is told so by git itself, not only by a line this file matched', () => {
    // Reading the file says the line is present. Only `git check-ignore` says
    // the line actually takes effect on the path the publish writes, which is
    // what a negation or an ordering mistake elsewhere in the file could undo.
    const run = spawned(
      spawnSync('git', ['check-ignore', '-v', 'public/contracts/tokens.css'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      })
    );
    expect(run.status, `git check-ignore said: ${run.stdout}${run.stderr}`).toBe(0);
    expect(run.stdout).toContain(IGNORED_PATH);
  });

  it('tracks nothing under public/contracts, which is the AD-4 drift rule', () => {
    const run = spawned(
      spawnSync('git', ['ls-files', '--', 'public/contracts'], { cwd: REPO_ROOT, encoding: 'utf8' })
    );
    expect(run.status, `git ls-files said: ${run.stderr}`).toBe(0);
    expect(
      run.stdout.trim(),
      'a second committed copy of a contract file is the drift AD-4 forbids: the served copy is built, never committed'
    ).toBe('');
  });

  it('holds no second copy of a contract file in anything the Hub serves or renders', () => {
    // The rule stated as a search rather than as a single path, so a copy that
    // landed under another name in the served tree is caught rather than only
    // the one path `.gitignore` covers.
    //
    // Scoped to what the Hub serves and renders. `packages/` is deliberately
    // outside it: `packages/fonts/sources/OFL-bricolage-grotesque.txt` and
    // `OFL-geist.txt` are the upstream licence files `packages/fonts/subset.py`
    // reads and copies into `contracts/fonts/`. They are generator inputs in
    // the directory AD-1 names as never published, which is where an input
    // belongs, and a rule that called them drift would be telling this
    // repository to delete the source of a published file.
    const SERVED_OR_RENDERED = ['app/', 'components/', 'public/'];
    const run = spawned(spawnSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' }));
    expect(run.status, `git ls-files said: ${run.stderr}`).toBe(0);
    const tracked = run.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
    expect(tracked.length, 'git listed no tracked files, so this case passed over nothing').toBeGreaterThan(0);
    const names = new Set(treeOf(SOURCE).map((file) => file.split('/').pop() as string));
    expect(names.size, 'the published surface enumerated no file names').toBeGreaterThan(0);
    const elsewhere = tracked.filter(
      (path) => SERVED_OR_RENDERED.some((where) => path.startsWith(where)) && names.has(path.split('/').pop() as string)
    );
    expect(
      elsewhere,
      'these tracked paths under app/, components/ or public/ share a file name with the published surface, and' +
        ' contracts/ is its one authored location (AD-4)'
    ).toEqual([]);
  });
});
