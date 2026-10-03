// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Story 5.8 (AD-13): `ops/demo-principal.md` is the one definition of the demo principal. The address each
// participant in this repository holds is the record's, every participant the record names is a `Live`
// Registry entry, and the tracker's demo switch reaches its container empty by default, so the application
// is unchanged until the Operator turns it on. `cs-tracker` and `digital-library` pin the same address in
// their own suites (AD-2).

const ROOT = process.cwd();
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8').replace(/\r\n/g, '\n');
const RECORD = read('ops/demo-principal.md');
const REGISTRY = JSON.parse(read('contracts/registry.json')) as {
  applications: { id: string; status: string; identity: string }[];
};

/** The Registry ids § Who participates marks `**yes**`. */
function participants(markdown: string): string[] {
  const section = markdown.split('\n## Who participates\n')[1]?.split('\n## ')[0];
  if (!section) throw new Error('no `## Who participates` section');
  return section
    .split('\n')
    .filter((l) => /^\| `[a-z0-9-]+`/.test(l) && l.split('|')[3]?.trim() === '**yes**')
    .map((l) => /^\| `([a-z0-9-]+)`/.exec(l)![1]);
}

describe('the record', () => {
  it('states the principal once, as demo@cuatro.dev', () => {
    expect(RECORD).toContain('1. **The principal is `demo@cuatro.dev`**');
  });

  it('names three participants, each a Live Registry entry and none structurally exempt', () => {
    const ids = participants(RECORD);
    expect(ids).toEqual(['cuatro-tracker', 'cs-tracker', 'digital-library']);
    for (const id of ids) {
      const entry = REGISTRY.applications.find((a) => a.id === id);
      expect(entry?.status, id).toBe('Live');
      expect(entry?.identity, id).not.toBe('wallet');
    }
  });

  it('reads the participants of one section only', () => {
    const text = ['# x', '## Who participates', '| `a` | x | **yes** | y |', '| `b` | x | no | y |', '## Next', '| `c` | x | **yes** |'].join('\n');
    expect(participants(text)).toEqual(['a']);
  });
});

describe('the participants in this repository', () => {
  it('the tracker holds the record’s address, not one of its own', () => {
    const source = read('apps/tracker/lib/demo-principal.ts');
    expect(/export const DEMO_PRINCIPAL = '([^']+)'/.exec(source)?.[1]).toBe('demo@cuatro.dev');
  });

  it('the tracker’s demo switch reaches its container, empty unless the Operator sets it', () => {
    const compose = read('docker-compose.yml');
    const tracker = compose.split('\n  tracker:\n')[1]?.split('\n  tracker-worker:\n')[0] ?? '';
    expect(tracker).toContain('      - DEMO_ENABLED=${TRACKER_DEMO_ENABLED-}\n');
  });
});
