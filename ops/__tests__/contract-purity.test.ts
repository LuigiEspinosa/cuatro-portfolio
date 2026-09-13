// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { inspect, report, EXECUTABLE, RULE, SURFACE, GENERATOR_HOME } from '../contract-purity.mjs';

// One standing case per row of the story's I/O matrix, plus one per refusal the
// checker makes that no matrix row names. A probe demonstrates that the gate
// could fail on the day it was run; these are what keep it able to fail after a
// later edit, and they sit inside the already-blocking `test` job rather than in
// the new one, so the two gates are independent readers of one rule.

// Resolved from the repository root, which is where Vitest runs. Not from
// `import.meta.url`: under Vitest that is a vite URL rather than a `file:` one,
// so neither `new URL(...)` nor `fileURLToPath` works here. The module's own
// read has the same shape, which is why every refusal below runs against a
// scratch tree and the real read is covered by the subprocess block instead.
const CHECKER = resolve(process.cwd(), 'ops/contract-purity.mjs');
const CONTRACTS = resolve(process.cwd(), 'contracts');
const WORKFLOW = resolve(process.cwd(), '.github/workflows/ci.yml');
const JOB = 'contract-purity';
const HERE = 'ops/__tests__/contract-purity.test.ts';

// Work done at collection time fails the whole file rather than one case, and a
// bare ENOENT there says nothing about what this suite wanted or what to do
// about it. Same treatment as the module-scope reads in
// `packages/tokens/__tests__/tailwind-adapter.test.ts`.
const atCollection = <T>(why: string, build: () => T): T => {
  try {
    return build();
  } catch (error) {
    throw new Error(`${HERE}: ${why} ${error instanceof Error ? error.message : String(error)}`);
  }
};

// `spawnSync` reports a failure to start in `error` and leaves `status` null,
// so an unguarded `run.status` turns a broken harness into what reads as a gate
// defect. Every spawn in this file goes through here.
const spawned = <T>(run: SpawnSyncReturns<T>): SpawnSyncReturns<T> => {
  if (run.error) throw run.error;
  return run;
};

// Every refusal case builds its own tree under `tmpdir()`, so the committed
// `contracts/` is never mutated by a test run and a killed run leaves nothing
// under the repository.
const withRoot = <T>(use: (root: string) => T): T => {
  const root = mkdtempSync(join(tmpdir(), 'contract-purity-'));
  try {
    return use(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

// A scratch surface named `contracts` under `root`, carrying `files`. The name
// matters: the module labels every path with its own `SURFACE` constant, so a
// scratch tree produces the exact string a runner prints for the real folder.
const surfaceWith = (root: string, ...files: string[]): string => {
  const surface = join(root, 'contracts');
  mkdirSync(surface, { recursive: true });
  for (const file of files) {
    const full = join(surface, ...file.split('/'));
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, '/* scratch */\n', 'utf8');
  }
  return surface;
};

// A link to a directory. `junction` is a Windows notion and is ignored on
// POSIX, where this makes an ordinary symbolic link, so one call covers both
// hosts and needs no privilege on either.
const linkDirectory = (target: string, path: string): void => symlinkSync(target, path, 'junction');

// A link at `name` under the surface. The first branch is the case the matrix
// row describes, a link to an executable file outside the folder.
const linkAt = (surface: string, name: string, target: string): void => {
  try {
    symlinkSync(target, join(surface, name), 'file');
  } catch {
    // Windows refuses a file symlink without Developer Mode or elevation, and a
    // case that quietly skips itself on the host where the published folder is
    // authored is the failure this whole file exists to prevent. The fallback
    // exercises a directory junction rather than a link to an executable file,
    // which is a weaker fixture for the same refusal: `lstat` reports both as
    // links and the walk refuses on that alone. It points at a dedicated empty
    // directory, never at the tree being walked, so teardown removes the link
    // rather than reaching through it.
    const fallback = join(dirname(target), 'junction-target');
    mkdirSync(fallback, { recursive: true });
    linkDirectory(fallback, join(surface, name));
  }
};

const refusalFor = (build: (surface: string) => void) =>
  withRoot((root) => {
    const surface = surfaceWith(root);
    build(surface);
    return report(inspect(surface));
  });

// A directory listing that never touches a filesystem. Two of the checker's
// refusals cannot be constructed portably on both a Windows authoring host and
// a Linux runner: a directory that refuses to be listed needs `chmod`, and an
// entry that is neither a file nor a directory needs `mkfifo`. The reader is
// injected instead, on the `main(argv, readFile = readFileSync)` precedent in
// `ops/capacity-gate.mjs`. It decides how a directory is listed, never which
// directory is read, and the two subprocess cases below run the undefaulted
// path end to end.
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

// ---------------------------------------------------------------------------
// Matrix row 1: the committed surface passes, and says what it read.
// ---------------------------------------------------------------------------

describe('the committed published surface', () => {
  // Counted with Node's own recursive walk rather than with the checker's, so
  // the positive control is not the thing under test counting itself.
  const committedFiles = atCollection(
    `the positive control reads the committed published surface at ${CONTRACTS}, and could not.` +
      ' A missing contracts/ is the state the checker refuses; it must not be the state this suite' +
      ' fails to collect in.',
    () => readdirSync(CONTRACTS, { recursive: true, withFileTypes: true }).filter((found) => found.isFile()).length
  );

  it('is not empty, so every case below is measuring something', () => {
    expect(committedFiles).toBeGreaterThan(0);
  });

  it('passes, and prints the surface and the number of files it read', () => {
    const result = report(inspect(CONTRACTS));
    expect(result.ok, result.message).toBe(true);
    expect(result.message).toContain(SURFACE);
    expect(result.message).toContain(`${committedFiles} files`);
  });

  it('carries no file the rule matches, which is what makes the pass meaningful', () => {
    const inspection = inspect(CONTRACTS);
    expect(inspection.read).toBe(true);
    // `read` only promises the surface root was opened and is a real directory.
    // A directory under it that would not list is a finding, not a false
    // `read`, so the empty findings list is what says the whole walk landed.
    expect(inspection.findings, 'the walk did not reach every directory under the committed surface').toEqual([]);
    for (const file of inspection.files) {
      expect(file, `${SURFACE}${file} is executable and ${SURFACE} is the published surface (AD-1)`).not.toMatch(
        EXECUTABLE
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Matrix rows 2 to 7: what the checker refuses, and what it lets through.
// ---------------------------------------------------------------------------

describe('the rule AD-1 states', () => {
  it('matches every one of the six extensions AD-1 names', () => {
    for (const extension of ['ts', 'js', 'tsx', 'jsx', 'mjs', 'cjs']) {
      expect(`probe.${extension}`, `AD-1 names .${extension}`).toMatch(EXECUTABLE);
    }
  });

  it('matches no data extension the published surface actually carries', () => {
    for (const name of ['tokens.css', 'notes.txt', 'registry.json', 'geist-latin.woff2', 'OFL-geist.txt']) {
      expect(name, `${name} is data and nothing about it is executable`).not.toMatch(EXECUTABLE);
    }
  });

  it('is quoted verbatim by the refusals, not paraphrased', () => {
    // Every refusal message names `RULE` as AD-1's own expression. A second
    // hand written literal that agrees today would let that claim go quietly
    // false, so the pattern is built from one list of extensions.
    expect(RULE).toBe(String.raw`\.(ts|js|tsx|jsx|mjs|cjs)$`);
  });

  it('is contained by the applied rule, so the check is stricter and never looser', () => {
    // The property that actually matters, and the one the record's whole
    // lower-bound argument rests on: everything AD-1 refuses, the checker
    // refuses. Source equality would forbid the deliberate deviations below.
    const ad1 = new RegExp(RULE, 'i');
    for (const extension of ['ts', 'js', 'tsx', 'jsx', 'mjs', 'cjs', 'TS', 'MJS']) {
      const name = `probe.${extension}`;
      expect(ad1.test(name), `${name} is the fixture`).toBe(true);
      expect(name, `AD-1 refuses ${name} and the applied rule lets it through, which is looser`).toMatch(EXECUTABLE);
    }
  });

  it('is applied case insensitively, which is stricter than AD-1 and never looser', () => {
    // Recorded as a deliberate deviation in `ops/contract-purity.md`. AD-1
    // fixes a lower bound, so a check may refuse more but never less.
    expect(EXECUTABLE.flags).toContain('i');
  });

  it('also names .mts and .cts, which AD-1 does not and Node runs directly', () => {
    // The third deviation stricter than AD-1, recorded with its reason.
    // `tsconfig.json:34-41` puts `**/*.mts` in this repository's own program.
    for (const extension of ['mts', 'cts']) {
      expect(`build.${extension}`, `.${extension} is TypeScript a runtime executes`).toMatch(EXECUTABLE);
      expect(new RegExp(RULE, 'i').test(`build.${extension}`), 'AD-1 does not name it, which is why this is a deviation').toBe(
        false
      );
    }
  });
});

describe('the checker refuses', () => {
  it('a planted probe, naming AD-1 and the path', () => {
    const result = refusalFor((surface) => writeFileSync(join(surface, 'probe.ts'), 'export {};\n', 'utf8'));
    expect(result.ok).toBe(false);
    expect(result.message).toContain('AD-1');
    expect(result.message).toContain('contracts/probe.ts');
  });

  it('a nested probe, naming the nested path with forward slashes', () => {
    const result = refusalFor((surface) => {
      mkdirSync(join(surface, 'fonts'), { recursive: true });
      writeFileSync(join(surface, 'fonts', 'helper.mjs'), 'export {};\n', 'utf8');
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('AD-1');
    expect(result.message).toContain('contracts/fonts/helper.mjs');
    // The separator is the point. A backslash here would mean a Windows
    // checkout and an Ubuntu runner print different strings for one defect.
    expect(result.message).not.toContain('fonts\\helper.mjs');
  });

  it('several offenders at once, naming every path in sorted order rather than only the first', () => {
    const result = refusalFor((surface) => {
      // Created in reverse-sorted order. Whether that survives into the listing
      // is a property of the filesystem, so the deterministic half of this is
      // the reversed-reader case below.
      writeFileSync(join(surface, 'probe.ts'), 'export {};\n', 'utf8');
      writeFileSync(join(surface, 'build.cjs'), 'module.exports = {};\n', 'utf8');
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('2 paths');
    expect(result.message.indexOf('contracts/build.cjs')).toBeGreaterThan(-1);
    expect(
      result.message.indexOf('contracts/build.cjs'),
      'the offenders are listed unsorted, so two runs over one tree can print two different messages'
    ).toBeLessThan(result.message.indexOf('contracts/probe.ts'));
  });

  it('the same offenders in sorted order however the filesystem lists them', () => {
    const result = withRoot((root) => {
      const surface = surfaceWith(root, 'probe.ts', 'build.cjs');
      return report(inspect(surface, (directory) => readdirSync(directory, { withFileTypes: true }).reverse()));
    });
    expect(result.ok).toBe(false);
    expect(result.message.indexOf('contracts/build.cjs')).toBeLessThan(result.message.indexOf('contracts/probe.ts'));
  });

  it('an extension in another case, because a case-insensitive checkout serves it as .ts', () => {
    const result = refusalFor((surface) => writeFileSync(join(surface, 'probe.TS'), 'export {};\n', 'utf8'));
    expect(result.ok).toBe(false);
    expect(result.message).toContain('contracts/probe.TS');
  });

  it('a name Win32 strips back to an executable one, such as a trailing dot', () => {
    // `probe.ts.` and `probe.ts ` are both served as `probe.ts` on Windows, so
    // the rule is applied to what the name resolves to. Stricter than AD-1's
    // literal pattern, never looser, and recorded as such.
    const result = withRoot((root) => {
      const surface = surfaceWith(root, 'tokens.css');
      writeFileSync(join(surface, 'probe.ts.'), 'export {};\n', 'utf8');
      return report(inspect(surface));
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('contracts/probe.ts.');
    expect(result.message).toContain('Win32');
  });

  it('a name Win32 strips back through a trailing space, which is the other half of that rule', () => {
    // Held separately from the trailing dot above, because narrowing
    // `WIN32_TRAILING` from `/[. ]+$/` to `/[.]+$/` leaves the dot case green
    // and silently drops half of a refusal `ops/contract-purity.md` states as
    // a fact. Fed through the injected reader rather than through a real file:
    // a trailing space is exactly the character a filesystem may normalise
    // away, and a fixture that quietly becomes a different fixture is what
    // this whole file exists to prevent.
    const result = withRoot((root) => {
      const surface = surfaceWith(root, 'tokens.css');
      return report(inspect(surface, () => [entry('tokens.css', 'file'), entry('probe.ts ', 'file')]));
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('contracts/probe.ts ');
    expect(result.message).toContain('Win32');
  });

  it('a .mts and a .cts, which AD-1 does not name and a runtime executes anyway', () => {
    const result = withRoot((root) => report(inspect(surfaceWith(root, 'build.mts', 'shim.cts'))));
    expect(result.ok).toBe(false);
    expect(result.message).toContain('contracts/build.mts');
    expect(result.message).toContain('contracts/shim.cts');
    // The refusal may not claim these match AD-1's expression, because they do
    // not. It says the rule does not name them and why they are refused anyway.
    expect(result.message).toContain("does not name");
    expect(result.message).toContain('Node runs it directly');
  });

  it('a link under the surface, naming the path as an unresolvable publication', () => {
    const result = withRoot((root) => {
      const outside = join(root, 'build.mjs');
      writeFileSync(outside, 'export {};\n', 'utf8');
      const surface = surfaceWith(root, 'tokens.css');
      linkAt(surface, 'data.css', outside);
      return report(inspect(surface));
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('contracts/data.css');
    expect(result.message).toContain('a link');
  });

  it('a surface root that is itself a link, rather than following it', () => {
    const result = withRoot((root) => {
      const elsewhere = join(root, 'elsewhere');
      mkdirSync(elsewhere, { recursive: true });
      writeFileSync(join(elsewhere, 'tokens.css'), ':root {}\n', 'utf8');
      const surface = join(root, 'contracts');
      linkDirectory(elsewhere, surface);
      return report(inspect(surface));
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('AD-1');
    expect(result.message).toContain('a link');
  });

  it('a missing directory, naming the directory it could not read', () => {
    const result = withRoot((root) => report(inspect(join(root, 'contracts'))));
    expect(result.ok).toBe(false);
    expect(result.message).toContain('AD-1');
    expect(result.message).toContain(`${SURFACE} could not be read`);
    expect(result.message).toContain('ENOENT');
  });

  it('a surface that is a file rather than a directory', () => {
    const result = withRoot((root) => {
      const surface = join(root, 'contracts');
      writeFileSync(surface, 'not a directory\n', 'utf8');
      return report(inspect(surface));
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('not a directory');
  });

  it('an empty surface, saying nothing was checked rather than passing', () => {
    const result = refusalFor(() => {});
    expect(result.ok).toBe(false);
    expect(result.message).toContain('AD-1');
    expect(result.message).toContain(`0 files under ${SURFACE}`);
  });

  it('a surface holding only empty directories, which is the same zero one level down', () => {
    const result = refusalFor((surface) => mkdirSync(join(surface, 'fonts'), { recursive: true }));
    expect(result.ok).toBe(false);
    expect(result.message).toContain(`0 files under ${SURFACE}`);
  });

  it('a subdirectory that cannot be listed, rather than counting it as zero files', () => {
    // The failure this closes: with `contracts/fonts/` unreadable and the three
    // CSS files readable, a checker that swallowed the error would print
    // "3 files, none executable" and exit 0 over a directory nobody opened.
    const result = withRoot((root) => {
      const surface = surfaceWith(root, 'tokens.css', 'fonts.css', 'tailwind.css', 'fonts/geist-latin.woff2');
      return report(
        inspect(surface, (directory) => {
          if (directory.endsWith('fonts')) throw failing('EACCES', 'permission denied');
          return readdirSync(directory, { withFileTypes: true });
        })
      );
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('contracts/fonts');
    expect(result.message).toContain('could not be listed');
    expect(result.message).toContain('EACCES');
    // Same as the socket below: a directory that would not list cannot be moved
    // under `packages/` and made to generate something, so the wording has to
    // follow the finding rather than the count.
    expect(result.message, 'an unlistable directory is reported as breaking the extension rule').toContain(
      'cannot stand as published data'
    );
    expect(result.message, 'an unlistable directory is told to publish what it generates').not.toContain(
      'and publish what'
    );
  });

  it('an error with no code, without letting its message forge a line either', () => {
    // `code()` falls back to an error's own message when it carries no `code`,
    // and that text is the one part of a reason that does not come from the
    // checker's own source. A newline in it forges a line in the refusal
    // exactly as one in a path does, and the path was escaped while this was
    // not.
    const result = withRoot((root) => {
      const surface = surfaceWith(root, 'tokens.css');
      return report(
        inspect(surface, () => {
          throw new Error('denied\n    contracts/nothing-to-see-here: fine.ts');
        })
      );
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain(String.raw`denied\n    contracts/nothing-to-see-here: fine.ts`);
    const forgedLines = result.message.split('\n').filter((line) => line.includes('nothing-to-see-here'));
    expect(forgedLines, 'the error text was printed as a line of its own').toHaveLength(1);
  });

  it("without escaping the rule's own backslash out of the reason it quotes", () => {
    // The other half of the case above. Only the error text is escaped, because
    // the rest of every reason is the checker's own prose and quotes `RULE`,
    // whose backslash has to reach an operator as itself. Escaping the whole
    // reason would print AD-1's expression with a doubled backslash in the one
    // line an operator reads to find out which rule fired.
    const result = refusalFor((surface) => writeFileSync(join(surface, 'probe.ts'), 'export {};\n', 'utf8'));
    expect(result.message).toContain(`contracts/probe.ts: executable code, matching AD-1's ${RULE}`);
  });

  it('a surface root that cannot be listed, naming the surface once', () => {
    const result = withRoot((root) => {
      const surface = surfaceWith(root, 'tokens.css');
      return report(
        inspect(surface, () => {
          throw failing('EACCES', 'permission denied');
        })
      );
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('could not be listed');
    expect(result.message, 'the surface is named twice').not.toContain('contracts/contracts');
  });

  it('an entry that is neither a file nor a directory nor a link', () => {
    const result = withRoot((root) => {
      const surface = surfaceWith(root, 'tokens.css');
      return report(inspect(surface, () => [entry('tokens.css', 'file'), entry('socket', 'other')]));
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('contracts/socket');
    expect(result.message).toContain('neither a file nor a directory');
    // A socket is not the extension rule firing, so it is not something to move
    // under `packages/` and publish the output of. Held here as well as in the
    // link case below, because the flag that decides the wording is set per
    // finding kind and flipping this one alone left every case green.
    expect(result.message, 'a socket is reported as a path breaking the extension rule').toContain(
      'cannot stand as published data'
    );
    expect(result.message, 'a socket is told to move under packages/ and publish what it generates').not.toContain(
      'and publish what'
    );
  });

  it('without letting a path forge extra lines in its own refusal', () => {
    // A name carrying a newline would otherwise push the real offender out of
    // an operator's view, or fake a line that reads like the checker's prose.
    const forged = 'evil\n    contracts/nothing-to-see-here: fine.ts';
    const result = withRoot((root) => {
      const surface = surfaceWith(root, 'tokens.css');
      return report(inspect(surface, () => [entry('tokens.css', 'file'), entry(forged, 'file')]));
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain(String.raw`contracts/evil\n    contracts/nothing-to-see-here: fine.ts`);
    const forgedLines = result.message.split('\n').filter((line) => line.includes('nothing-to-see-here'));
    expect(forgedLines, 'the forged text was printed as a line of its own').toHaveLength(1);
    expect(forgedLines[0]).toContain('contracts/evil');
  });

  it('without printing two different names as one string', () => {
    // The escaping has to be injective or it is a second way to hide. A name
    // written with a literal backslash and an `n` must not print as the name
    // that carries a real newline, which is what the case above turns into
    // `\n`. A backslash is therefore escaped as well.
    const real = 'a\nb.ts';
    const literal = String.raw`a\nb.ts`;
    const messageFor = (name: string) =>
      withRoot((root) => {
        const surface = surfaceWith(root, 'tokens.css');
        return report(inspect(surface, () => [entry('tokens.css', 'file'), entry(name, 'file')])).message;
      });
    expect(messageFor(real), 'two different published names print as one string').not.toBe(messageFor(literal));
    expect(messageFor(literal)).toContain(String.raw`contracts/a\\nb.ts`);
  });

  it('without letting a name be drawn as something other than what it is', () => {
    // U+202E reorders how the rest of the name is drawn, so `probe.ts` can be
    // shown to an operator as a name with no executable extension at all, and
    // U+2028 terminates a line for a JavaScript reader and for some log
    // viewers the same way a newline does. Neither is a C0 control, so neither
    // was caught by a code point test alone.
    //
    // Built from code points rather than written into this file, so this source
    // carries no character that draws as something other than what it is.
    // U+0085 and U+009B are C1 controls, which a terminal reads as escape
    // sequence introducers and which a code point test that only knows about
    // the C0 range walks straight past. U+00AD, U+061C, U+200B and U+FEFF are
    // drawn as nothing at all, so two different published names render as one
    // string in a log, which is the same disguise by another route.
    for (const point of [0x202e, 0x2028, 0x200f, 0x0085, 0x009b, 0x00ad, 0x061c, 0x200b, 0xfeff]) {
      const hidden = String.fromCodePoint(point);
      const result = withRoot((root) => {
        const surface = surfaceWith(root, 'tokens.css');
        return report(inspect(surface, () => [entry('tokens.css', 'file'), entry(`probe${hidden}.ts`, 'file')]));
      });
      expect(result.ok).toBe(false);
      expect(result.message, `U+${point.toString(16)} reached the operator's log as itself`).not.toContain(hidden);
      // Escaped in the width the module uses: two digits below U+0100, four
      // above, which is what keeps the escaping readable rather than uniform.
      const escaped =
        point > 0xff
          ? `\\u${point.toString(16).padStart(4, '0')}`
          : `\\x${point.toString(16).padStart(2, '0')}`;
      expect(result.message).toContain(escaped);
    }
  });

  it('without drawing two names that differ only by an invisible character as one string', () => {
    // The injectivity argument applied to the class above. A published
    // `tokens.css` beside a `tokens.css` carrying a zero width space is two
    // different names, and an operator who cannot tell them apart in the log
    // cannot act on either.
    const messageFor = (name: string) =>
      withRoot((root) => {
        const surface = surfaceWith(root, 'tokens.css');
        return report(inspect(surface, () => [entry('tokens.css', 'file'), entry(name, 'file')])).message;
      });
    expect(messageFor(`probe${String.fromCodePoint(0x200b)}.ts`)).not.toBe(messageFor('probe.ts'));
  });


  it('and tells the operator what to do about the entry it actually found', () => {
    // Only an executable file is something to move under `packages/` and
    // publish the output of. A link is not, and a refusal that said so would
    // be an instruction an operator cannot follow.
    const link = withRoot((root) => {
      const outside = join(root, 'build.mjs');
      writeFileSync(outside, 'export {};\n', 'utf8');
      const surface = surfaceWith(root, 'tokens.css');
      linkAt(surface, 'data.css', outside);
      return report(inspect(surface));
    });
    expect(link.ok).toBe(false);
    expect(link.message, 'a link is told it breaks an extension rule it does not match').not.toContain(
      'breaks that rule'
    );
    expect(link.message, 'a link is not something to move under packages/ and publish the output of').not.toContain(
      'and publish what'
    );
    expect(link.message).toContain('cannot stand as published data');
    expect(link.message).toContain('has to become a plain file');
    // Where a generator belongs is still named, because a mixed refusal may
    // carry an executable file too.
    expect(link.message).toContain(GENERATOR_HOME);

    // And the wording the probe output recorded in `ops/contract-purity.md`
    // quotes is still exactly what a plain executable file produces.
    const probe = refusalFor((surface) => writeFileSync(join(surface, 'probe.ts'), 'export {};\n', 'utf8'));
    expect(probe.message).toContain(`1 path under ${SURFACE} breaks that rule:`);
    expect(probe.message).toContain(`Move it under ${GENERATOR_HOME}, which is never published, and publish what`);
    expect(probe.message).toContain('it generates instead.');
  });

  it('and keeps that wording off a refusal that carries a link beside an executable file', () => {
    // The case above builds two homogeneous fixtures, so the header branch it
    // exercises agrees whether it is written as `every` or as `some`. This is
    // the mixed refusal that separates them: one finding is the extension rule
    // firing and one is not, and the closing advice has to be the one an
    // operator can follow for both.
    const mixed = withRoot((root) => {
      const outside = join(root, 'build.mjs');
      writeFileSync(outside, 'export {};\n', 'utf8');
      const surface = surfaceWith(root, 'tokens.css');
      writeFileSync(join(surface, 'probe.ts'), 'export {};\n', 'utf8');
      linkAt(surface, 'data.css', outside);
      return report(inspect(surface));
    });
    expect(mixed.ok).toBe(false);
    expect(mixed.message).toContain('contracts/probe.ts');
    expect(mixed.message).toContain('contracts/data.css');
    expect(mixed.message, 'a refusal carrying a link says every entry breaks the extension rule').toContain(
      '2 entries under contracts/ cannot stand as published data:'
    );
    expect(mixed.message, 'the link is told to move under packages/ and publish what it generates').not.toContain(
      'and publish what'
    );
    expect(mixed.message).toContain('has to become a plain file');
  });
});

describe('the checker passes', () => {
  it('a near miss, because the rule matches the final extension only', () => {
    const result = withRoot((root) => {
      const surface = surfaceWith(root, 'notes.txt', 'a.css.map', 'tokens.css');
      expect(existsSync(join(surface, 'a.css.map'))).toBe(true);
      return report(inspect(surface));
    });
    expect(result.ok, result.message).toBe(true);
    expect(result.message).toContain('3 files');
  });

  it('a nested data surface, counting every file it walked into', () => {
    const result = withRoot((root) =>
      report(inspect(surfaceWith(root, 'tokens.css', 'fonts/geist-latin.woff2', 'fonts/OFL-geist.txt')))
    );
    expect(result.ok, result.message).toBe(true);
    expect(result.message).toContain('3 files');
  });

  it('a directory whose own name matches the rule, and walks into it', () => {
    // The rule is about what a consumer executes, and a directory publishes
    // nothing. This was a review finding rejected on that reasoning, which
    // until now rested on the review log alone: a later edit that started
    // refusing the directory, or that stopped walking into it, passed every
    // case in this file.
    const result = withRoot((root) => report(inspect(surfaceWith(root, 'util.mjs/tokens.css', 'util.mjs/fonts.css'))));
    expect(result.ok, result.message).toBe(true);
    expect(result.message, 'the walk did not descend into the directory').toContain('2 files');
  });
});

describe('the injected reader', () => {
  it('lists the directory it is handed and selects none of its own', () => {
    const asked: string[] = [];
    withRoot((root) => {
      const surface = surfaceWith(root, 'tokens.css', 'fonts/geist-latin.woff2');
      return report(
        inspect(surface, (directory) => {
          asked.push(directory);
          return readdirSync(directory, { withFileTypes: true });
        })
      );
    });
    // The surface and its one subdirectory, in that order, and nothing else.
    expect(asked).toHaveLength(2);
    expect(asked[0].endsWith('contracts')).toBe(true);
    expect(asked[1].endsWith(join('contracts', 'fonts'))).toBe(true);
  });
});

describe('every refusal', () => {
  // One fixture per kind of refusal the checker makes, not a sample of them.
  // The block is written as though it enumerates every refusal, so a kind left
  // out of this list is a kind whose header nothing holds: they inherit it
  // through one helper today, and a refusal built without that helper would
  // slip past a list that stopped at three.
  const messages = atCollection('the refusal fixtures could not be built under tmpdir().', () => [
    refusalFor((surface) => writeFileSync(join(surface, 'probe.ts'), 'export {};\n', 'utf8')),
    refusalFor((surface) => writeFileSync(join(surface, 'build.mts'), 'export {};\n', 'utf8')),
    refusalFor(() => {}),
    withRoot((root) => report(inspect(join(root, 'contracts')))),
    withRoot((root) => {
      const outside = join(root, 'build.mjs');
      writeFileSync(outside, 'export {};\n', 'utf8');
      const surface = surfaceWith(root, 'tokens.css');
      linkAt(surface, 'data.css', outside);
      return report(inspect(surface));
    }),
    withRoot((root) =>
      report(inspect(surfaceWith(root, 'tokens.css'), () => [entry('tokens.css', 'file'), entry('socket', 'other')]))
    ),
    withRoot((root) => {
      const surface = surfaceWith(root, 'tokens.css', 'fonts/geist-latin.woff2');
      return report(
        inspect(surface, (directory) => {
          if (directory.endsWith('fonts')) throw failing('EACCES', 'permission denied');
          return readdirSync(directory, { withFileTypes: true });
        })
      );
    }),
  ]);

  it('names AD-1, so an operator reading a runner log is sent to the rule', () => {
    for (const result of messages) {
      expect(result.ok).toBe(false);
      expect(result.message).toContain('AD-1');
    }
  });

  it('names the published surface and where a generator belongs instead', () => {
    for (const result of messages) {
      expect(result.message).toContain(SURFACE);
      expect(result.message).toContain(GENERATOR_HOME);
    }
  });

  it('quotes the rule it is enforcing rather than paraphrasing it', () => {
    for (const result of messages) expect(result.message).toContain(RULE);
  });
});

// ---------------------------------------------------------------------------
// The real read path, through the binary the CI job actually runs.
// ---------------------------------------------------------------------------

describe('the checker as the job runs it', () => {
  // The module resolves its surface at `../contracts`, so a scratch copy of the
  // module one directory below a scratch surface exercises the real read, the
  // real `lstat` and the real exit code without ever touching the committed
  // folder.
  const runBeside = (build: (root: string) => void) =>
    withRoot((root) => {
      build(root);
      const ops = join(root, 'ops');
      mkdirSync(ops, { recursive: true });
      const copy = join(ops, 'contract-purity.mjs');
      copyFileSync(CHECKER, copy);
      return spawned(spawnSync(process.execPath, [copy], { encoding: 'utf8' }));
    });

  it('exits 0 against the committed tree and says what it read', () => {
    const run = spawned(spawnSync(process.execPath, [CHECKER], { encoding: 'utf8' }));
    expect(run.status, `${run.stdout}${run.stderr}`).toBe(0);
    expect(run.stdout).toContain(SURFACE);
    expect(run.stdout).toMatch(/\d+ files/);
  });

  it('resolves the surface beside the module, so it works from any working directory', () => {
    const run = spawned(
      spawnSync(process.execPath, [CHECKER], { encoding: 'utf8', cwd: resolve(process.cwd(), 'ops') })
    );
    expect(run.status, `${run.stdout}${run.stderr}`).toBe(0);
  });

  it('exits 1 and writes the refusal to stderr when a probe is planted', () => {
    const run = runBeside((root) => {
      surfaceWith(root, 'tokens.css');
      writeFileSync(join(root, 'contracts', 'probe.ts'), 'export {};\n', 'utf8');
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('AD-1');
    expect(run.stderr).toContain('contracts/probe.ts');
    expect(run.stdout).toBe('');
  });

  it('refuses a linked surface root through its own entry point, not only through inspect()', () => {
    // The refusal that a trailing separator on the resolved path would silence.
    // On POSIX `lstat("contracts/")` reports the target rather than the link, so
    // this is the case that would have been dead on the Ubuntu runner while
    // every in-process case stayed green.
    const run = runBeside((root) => {
      const elsewhere = join(root, 'elsewhere');
      mkdirSync(elsewhere, { recursive: true });
      writeFileSync(join(elsewhere, 'tokens.css'), ':root {}\n', 'utf8');
      linkDirectory(elsewhere, join(root, 'contracts'));
    });
    expect(run.status, `${run.stdout}${run.stderr}`).toBe(1);
    expect(run.stderr).toContain('a link');
  });

  it('reads no argument, so nothing at the call site can point it somewhere else', () => {
    const run = withRoot((root) => {
      const surface = surfaceWith(root, 'tokens.css');
      writeFileSync(join(surface, 'probe.ts'), 'export {};\n', 'utf8');
      return spawned(spawnSync(process.execPath, [CHECKER, surface], { encoding: 'utf8' }));
    });
    // The argument named a surface carrying a probe. A checker that honoured it
    // would exit 1 here, and would be a checker any caller could point at a
    // clean directory instead.
    expect(run.status, `${run.stdout}${run.stderr}`).toBe(0);
  });

  it('reads no environment variable either, which is the same hole with a different shape', () => {
    // `ci.yml` had to pin two build inputs empty on the `tokens-contract` job to
    // close this hole for the drift gate. Asserted on the source rather than by
    // guessing at a variable name, so a future variable cannot slip past a test
    // that only knew the old one. `process.argv` is asserted by shape for the
    // same reason: banning `.slice` would leave `process.argv[2]` free.
    const source = readFileSync(CHECKER, 'utf8');
    const instructions = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    expect(instructions).not.toContain('process.env');
    // `import { env } from 'node:process'` spells no `process.env` and passes
    // the `node:`-only import case below, and `env.ANYTHING` then reads the
    // environment freely. The specifier is the thing to close, since nothing
    // else in this checker needs it.
    expect(instructions, 'node:process is a route to the environment that spells no "process.env"').not.toMatch(
      /from\s*['"]node:process['"]/
    );
    const argv = [...instructions.matchAll(/process\.argv[^\s,;)]*/g)].map((match) => match[0]);
    expect(argv.length).toBeGreaterThan(0);
    for (const use of argv) {
      expect(use, 'the checker reads an argv position other than the script path').toBe('process.argv[1]');
    }
  });

  it('imports only node builtins, which is what lets the job install nothing', () => {
    const source = readFileSync(CHECKER, 'utf8');
    const specifiers = [...source.matchAll(/^import\s[^'"]*['"]([^'"]+)['"]/gm)].map((match) => match[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) expect(specifier).toMatch(/^node:/);
  });

  it('never answers "not invoked directly" when it cannot tell', () => {
    // The guard compares `process.argv[1]` to this module's own path through
    // `realpathSync`. If that throws and the guard answers no, the process runs
    // nothing at all and exits 0: a gate failing open, which is the one outcome
    // this whole file exists to prevent. The fallback has to be a comparison,
    // never a bare `false`.
    //
    // Asserted on the source rather than by running it, because reaching the
    // throwing branch needs a path the operating system will not resolve while
    // still being the script Node just executed, which no portable call can
    // arrange on both a Windows host and a Linux runner.
    const source = readFileSync(CHECKER, 'utf8');
    const guard = source.slice(source.indexOf('function sameFile'));
    const fallback = guard
      .slice(guard.indexOf('catch'), guard.indexOf('\n}'))
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    expect(fallback.length, 'the invoked-directly guard has no catch to inspect').toBeGreaterThan(0);
    expect(fallback, 'the invoked-directly guard fails open when a path will not resolve').not.toMatch(
      /return\s+false/
    );
    expect(fallback, 'the fallback is not a comparison of the two paths').toMatch(/resolve\(.+===.+resolve\(/);
  });

  it('records the verdict before it writes, so a lost write callback cannot exit 0', () => {
    // `process.exit` sits inside the write callback deliberately: on a pipe,
    // which is what a runner gives this process, exiting before the flush cuts
    // the refusal off and leaves a failing step with nothing explaining why.
    // But a stream torn down before that callback runs never calls it, and a
    // process that falls off the end of the module exits 0. On a refusal that
    // is the gate failing open on the one path that reports a violation, so
    // `process.exitCode` carries the verdict and the callback only decides
    // when to leave.
    //
    // Asserted on the source, because tearing a runner's stderr down between
    // the write and its callback is not something a portable spawn arranges.
    const source = readFileSync(CHECKER, 'utf8');
    const guarded = source.slice(source.indexOf('if (invokedDirectly)'));
    expect(guarded.length, 'the invoked-directly block has no body to inspect').toBeGreaterThan(0);
    const instructions = guarded
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    const verdict = instructions.indexOf('process.exitCode');
    const write = instructions.indexOf('stream.write');
    expect(verdict, 'the verdict is recorded nowhere outside the write callback').toBeGreaterThan(-1);
    expect(write, 'the message is written nowhere, so there is no ordering to hold').toBeGreaterThan(-1);
    expect(verdict, 'the verdict is recorded after the write, so a lost callback exits 0').toBeLessThan(write);
  });

  it('reaches for no dependency by any other route either', () => {
    // A static import is not the only way in, and the consequence here is worse
    // than a slow job: the job installs nothing on purpose, so a package
    // specifier reached at runtime is a hard crash on the very run the "still
    // reports when the install fails" argument exists to cover. Asserted on the
    // source rather than by name, so a future route cannot slip past a test
    // that only knew the old ones.
    const source = readFileSync(CHECKER, 'utf8');
    const instructions = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    const dynamic = [...instructions.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
    for (const specifier of dynamic) expect(specifier, 'a dynamic import reaches outside node:').toMatch(/^node:/);
    expect(instructions, 'createRequire is a route to a package the job never installs').not.toContain('createRequire');
    expect(instructions, 'a bare require() is the same route with a shorter name').not.toMatch(/\brequire\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// Matrix rows 10 and 11: the workflow's own wiring, read as the data it is.
// Nothing executes `ci.yml` before it reaches `main`.
// ---------------------------------------------------------------------------

describe('the CI wiring', () => {
  // Line endings normalised before anything is matched. `.gitattributes` pins
  // LF by format and names no `.yml`, so this file arrives CRLF on a Windows
  // checkout and every anchored pattern below would miss on the authoring host
  // while passing on the runner.
  const workflow = atCollection(`${WORKFLOW} could not be read, and it is the file this block asserts.`, () =>
    readFileSync(WORKFLOW, 'utf8').replace(/\r\n/g, '\n')
  );
  const marker = '\njobs:\n';
  const at = workflow.indexOf(marker);
  if (at === -1) throw new Error(`${HERE}: ${WORKFLOW} has no top-level "jobs:" key, so no job can be read out of it`);
  const jobsSection = workflow.slice(at + marker.length);
  // GitHub allows a job id to start with a letter in either case or an
  // underscore. A pattern that only knew lower case would let a job named
  // `E2E` be added without the set below noticing, and would let `blockFor`
  // swallow it into the preceding job's block, which is worse: the assertions
  // would then run over the wrong job and report the wrong name.
  const JOB_ID = /^ {2}([A-Za-z_][A-Za-z0-9_-]*):$/gm;
  const jobNames = [...jobsSection.matchAll(JOB_ID)].map((match) => match[1]);

  const blockFor = (name: string): string => {
    const lines = jobsSection.split('\n');
    const start = lines.indexOf(`  ${name}:`);
    if (start === -1) throw new Error(`${HERE}: no job named ${name} in ${WORKFLOW}`);
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index += 1) {
      if (/^ {2}[A-Za-z_]/.test(lines[index])) {
        end = index;
        break;
      }
    }
    return lines.slice(start, end).join('\n');
  };

  // Comments in the new job discuss `continue-on-error` and `if:` by name, so
  // the assertions below read the job's instructions rather than its prose.
  const instructionsOf = (name: string): string =>
    blockFor(name)
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');

  it(`carries a ${JOB} job`, () => {
    expect(jobNames, `the ${JOB} job is gone from ${WORKFLOW}, so AD-1 has no gate holding it`).toContain(JOB);
  });

  it('runs the checker this file tests, with no argument beside it', () => {
    const commands = [...instructionsOf(JOB).matchAll(/^\s*run: (.+)$/gm)].map((match) => match[1].trim());
    expect(commands, `the ${JOB} job runs something other than the checker, or runs more than one thing`).toEqual([
      'node ops/contract-purity.mjs',
    ]);
    expect(existsSync(CHECKER), 'the job names a script that is not in the tree').toBe(true);
  });

  it('never downgrades the job to a warning and never makes it conditional (AD-21)', () => {
    const instructions = instructionsOf(JOB);
    expect(instructions, `AD-21: the ${JOB} job may never be soft-failed`).not.toMatch(/continue-on-error\s*:/);
    expect(instructions, `AD-21: the ${JOB} job may never swallow a non-zero exit`).not.toContain('|| true');
    expect(instructions, `AD-21: the ${JOB} job may never be skipped`).not.toMatch(/^\s+if\s*:/m);
    // `needs:` is a skip condition wearing another name. A `needs: test` here
    // would silently drop the purity gate on every run where the suite is
    // already red, which is exactly the run where the published folder is most
    // likely to have been reached for.
    expect(
      instructions,
      `AD-21: the ${JOB} job may never be skipped because another job failed first`
    ).not.toMatch(/^\s+needs\s*:/m);
  });

  it('runs where the record says it runs, on the Node the record says', () => {
    // Both figures are tabled in `ops/contract-purity.md`, which states its own
    // rule that a figure this file states and nothing asserts is one that
    // drifts. `timeout-minutes` and the absence of `env:` were already pinned;
    // these two were not.
    const instructions = instructionsOf(JOB);
    expect(instructions, 'ops/contract-purity.md tables ubuntu-latest').toMatch(/^\s+runs-on: ubuntu-latest$/m);
    expect(instructions, 'ops/contract-purity.md tables Node 22 through setup-node').toMatch(
      /^\s+node-version: 22$/m
    );
    expect(instructions, 'a container: would change what the recorded run means').not.toMatch(/^\s+container\s*:/m);
  });

  it("declares no on: of its own, so it runs on the file's triggers and the two cannot drift", () => {
    expect(instructionsOf(JOB)).not.toMatch(/^\s+on\s*:/m);
    expect(workflow).toMatch(/^on:\n {2}push:\n {4}branches: \['\*\*'\]\n {2}pull_request:\n {4}branches: \[main\]$/m);
  });

  it('declares no env:, so no runner environment reaches the checker', () => {
    // The two contract jobs each carry an `env:` pinning their build inputs
    // empty. This job needs none because nothing it runs reads one, and an
    // `env:` appearing here would mean something started to.
    expect(instructionsOf(JOB), `the ${JOB} job gained an env: block`).not.toMatch(/^\s+env\s*:/m);
    // And none at the top level of the file either. A workflow-wide `env:`
    // reaches every job including this one, so the claim this case makes is
    // only true while both are absent, and the job block alone cannot see it.
    expect(workflow, 'ci.yml gained a top-level env: block, which reaches every job in the file').not.toMatch(
      /^env\s*:/m
    );
  });

  it('carries the two actions the record tables and no step beside them', () => {
    // The `run:` case above pins the one command the job runs. Nothing pinned
    // the action steps, so a fourth step could be added to the one job in this
    // file that deliberately installs nothing, and `ops/contract-purity.md`
    // states as a fact that the job carries exactly three steps.
    const actions = [...instructionsOf(JOB).matchAll(/^\s*- uses: (.+)$/gm)].map((match) => match[1].trim());
    expect(actions, `the ${JOB} job gained or lost an action step`).toEqual([
      'actions/checkout@v7',
      'actions/setup-node@v7',
    ]);
    // From v5, `setup-node` caches automatically whenever `package.json` carries
    // a `packageManager` field, and this repository's does. This job has no
    // `pnpm/action-setup` step, so the automatic path would look for a pnpm that
    // was never installed, and `ops/contract-purity.md` states as a fact that
    // the job uses no cache.
    expect(instructionsOf(JOB), 'setup-node will cache off packageManager unless this is here').toMatch(
      /^\s+package-manager-cache: false$/m
    );
  });

  it('carries the ceiling the record states', () => {
    expect(instructionsOf(JOB), 'ops/contract-purity.md tables timeout-minutes: 5').toMatch(
      /^\s+timeout-minutes: 5$/m
    );
  });

  it('sits among the six jobs the file carries, and adds no other', () => {
    // This set and the identical one in `ops/__tests__/registry-schema.test.ts`
    // are the fourth committed assertion the contents of `ci.yml` are pinned by,
    // and adding a job fails both. That is deliberate: each of the two suites
    // reads the file for its own gate, and neither may be the only reader.
    expect(
      jobNames,
      'the order is a reader convenience rather than a rule, since jobs run in parallel. The set is not: a job' +
        ' added or removed here changes what holds AD-1 and what this suite has been told to expect'
    ).toEqual(['test', 'tokens-contract', 'fonts-contract', JOB, 'registry-schema', 'rendered-output']);
  });

  it('leaves the five jobs beside it carrying the steps they carried', () => {
    // Not a byte comparison against a baseline commit, which each story that
    // touches `ci.yml` verifies once by hand. This is the standing half: every
    // job in the file still does the thing it exists to do, so a later edit
    // that guts one of them is caught here rather than in production.
    //
    // It was four jobs until Story 2-3 added `registry-schema`, the Registry's
    // own blocking gate (AD-4). That job's command and steps are asserted in
    // `ops/__tests__/registry-schema.test.ts`, beside the module it runs, so
    // only its presence is checked here.
    expect(instructionsOf('test')).toContain('pnpm test --run');
    expect(instructionsOf('test')).toContain('pnpm typecheck');
    expect(instructionsOf('tokens-contract')).toContain('pnpm tokens:build');
    expect(instructionsOf('fonts-contract')).toContain('pnpm fonts:build');
    expect(instructionsOf('registry-schema')).toContain('node ops/registry-schema.mjs');
    expect(instructionsOf('rendered-output')).toContain('pnpm test:e2e');
  });
});
