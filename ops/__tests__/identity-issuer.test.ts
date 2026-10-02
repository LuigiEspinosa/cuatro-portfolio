// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Story 5.2 (AD-3, AD-11): `ops/identity-issuer.md` § The clients names one OIDC client per participating
// application. Every name in a row is derived from the Registry id, never chosen; `.env.example` documents
// every variable with an empty value (Pending Operator action 8); and no file in the repository assigns
// one a value, because the values live only in GitHub Actions secrets and the on-box env files.

const ROOT = process.cwd();
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8').replace(/\r\n/g, '\n');
const RECORD = read('ops/identity-issuer.md');
const REGISTRY = JSON.parse(read('contracts/registry.json')) as {
  applications: { id: string; identity: string }[];
};

interface Client {
  id: string;
  name: string;
  clientIdVariable: string;
  secretVariable: string;
}

/** The rows of § The clients whose first cell is a backticked id. */
function clientRows(markdown: string): Client[] {
  const section = markdown.split('\n## The clients\n')[1]?.split('\n## ')[0];
  if (!section) throw new Error('no `## The clients` section');
  return section
    .split('\n')
    .filter((l) => /^\| `[a-z0-9-]+` \|/.test(l))
    .map((l) => l.split('|').slice(1, 5).map((c) => c.trim().replace(/`/g, '')))
    .map(([id, name, clientIdVariable, secretVariable]) => ({ id, name, clientIdVariable, secretVariable }));
}

/** AD-3's derivation: the id uppercased, hyphens as underscores. */
const prefix = (id: string) => id.toUpperCase().replace(/-/g, '_');

const clients = clientRows(RECORD);
const variables = ['OIDC_ISSUER', ...clients.flatMap((c) => [c.clientIdVariable, c.secretVariable])];

/**
 * A git grep ERE for a value assigned to one of `names`: `NAME=value` (env file, shell), `NAME: value`
 * (a compose `environment:` map, a workflow `env:` block; YAML indents with spaces only) or `"NAME": "value"`
 * (JSON, where the colon follows the closing quote and the space is optional). An optional opening quote is
 * allowed, and a value starting with whitespace, a `$` interpolation, a quote or a closing backtick in prose
 * is not a value.
 */
const valuePattern = (names: string[]) => `(${names.join('|')})(=|: +|": *)["']?[^[:space:]$"'\`]`;

describe('the parser', () => {
  it('reads the rows of one section only', () => {
    const text = ['# x', '## The clients', '| Id | Name |', '| `a-b` | `a-b` | `A` | `B` | x |', '## Next', '| `c` | `c` | `C` | `D` |'].join('\n');
    expect(clientRows(text)).toEqual([{ id: 'a-b', name: 'a-b', clientIdVariable: 'A', secretVariable: 'B' }]);
    expect(() => clientRows('nothing')).toThrow(/no `## The clients`/);
  });
});

describe('one OIDC client per participating application (AD-3)', () => {
  it('names the FR-21 pair, each once, and only Registry ids that are not wallet', () => {
    const ids = clients.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['cuatro-portfolio', 'cs-tracker']));
    expect(new Set(ids).size).toBe(ids.length);
    const registry = new Map(REGISTRY.applications.map((a) => [a.id, a.identity]));
    for (const id of ids) {
      expect(registry.has(id), id).toBe(true);
      expect(registry.get(id), id).not.toBe('wallet');
    }
  });

  it('derives the Clerk application name and both variables from the id', () => {
    for (const c of clients) {
      expect(c.name, c.id).toBe(c.id);
      expect(c.clientIdVariable, c.id).toBe(`${prefix(c.id)}_OIDC_CLIENT_ID`);
      expect(c.secretVariable, c.id).toBe(`${prefix(c.id)}_OIDC_CLIENT_SECRET`);
    }
  });
});

describe('credentials never live in the repository', () => {
  // The authoring session's permission settings deny every read and write of `.env.*`, so `.env.example`
  // could not be edited in Story 5.2. `ops/identity-issuer.md` Pending Operator action 8 appends the
  // documented block and turns this into the case below, in the same commit:
  //   const example = read('.env.example');
  //   for (const v of variables) expect(new RegExp(`^${v}=[ \\t]*$`, 'm').test(example), v).toBe(true);
  it.todo('documents every variable in .env.example with an empty value');

  it('the value pattern catches the env, YAML and JSON assignment forms and spares interpolations', () => {
    const re = new RegExp(valuePattern(['X_OIDC_CLIENT_SECRET']).replace('[:space:]', '\\s'));
    for (const hit of ['X_OIDC_CLIENT_SECRET=v', 'X_OIDC_CLIENT_SECRET="v"', '  X_OIDC_CLIENT_SECRET: v', "X_OIDC_CLIENT_SECRET: 'v'", '{"X_OIDC_CLIENT_SECRET": "v"}', '{"X_OIDC_CLIENT_SECRET":"v"}'])
      expect(re.test(hit), hit).toBe(true);
    for (const miss of ['X_OIDC_CLIENT_SECRET=', 'X_OIDC_CLIENT_SECRET=""', 'X_OIDC_CLIENT_SECRET=${X}', 'X_OIDC_CLIENT_SECRET: ${{ secrets.X }}', 'X_OIDC_CLIENT_SECRET: "${X}"', '`X_OIDC_CLIENT_SECRET`: prose', 'X_OIDC_CLIENT_SECRET:', '"X_OIDC_CLIENT_SECRET": ""', '"X_OIDC_CLIENT_SECRET": "${X}"'])
      expect(re.test(miss), miss).toBe(false);
  });

  it('assigns no variable a value in any tracked or untracked, unignored file', () => {
    const pattern = valuePattern(variables);
    const found = spawnSync('git', ['grep', '--untracked', '-l', '-E', pattern], { cwd: ROOT, encoding: 'utf8' });
    expect(found.error).toBeUndefined();
    expect(found.stdout.trim()).toBe('');
    expect(found.status).toBe(1);
  });
});
