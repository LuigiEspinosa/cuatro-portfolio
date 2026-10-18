// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The retrospectives' process rules stay where agents read them (Story 9-2, 2026-10-18).
 *
 * AGENTS.md carries five outside the managed `bmad:context` block, which a context refresh replaces;
 * `_bmad/custom/bmad-build.toml` carries four as Build persistent facts and the verifier line in
 * `on_complete`. Nothing else turns red if a refresh, a move into the block or an edit drops one.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

const AGENTS_RULES = [
  'A story waiting on the Operator is not `done`** (Epic 2 action 10)',
  'Cite code by symbol or test name, never by line number** (Epic 2 action 13)',
  'A box step lands in the standing runbook in the same change** (Epic 5 action 51)',
  'A dated row relying on CI names every workflow it read, on the full sha** (Epic 5 action 52)',
  'An agent step gated on an Operator row waits for that row\'s dated completion** (Epic 8 action',
];

const BUILD_FACTS = [
  '"""No new deferred work (Operator ruling 2026-10-18, Epic 2 retrospective action 14',
  '"""Open inferences (Epic 8 retrospective action 61).',
  '"""Planted assertions (Epic 2 retrospective action 12).',
  '"""Independent verifier (Epic 2 retrospective action 11).',
];

/** The text after the managed block's closing marker, from the process rules heading on. */
const processSection = (agents: string): string => {
  const closing = agents.indexOf('<!-- /bmad:context -->');
  const heading = agents.search(/^## Process rules from retrospectives$/m);
  if (closing < 0 || heading < closing) return '';
  const next = agents.slice(heading + 1).search(/^## /m);
  return next < 0 ? agents.slice(heading) : agents.slice(heading, heading + 1 + next);
};

/** The `persistent_facts = [ ... ]` array's text, or '' when it is absent. */
const persistentFacts = (toml: string): string => {
  const start = toml.indexOf('\npersistent_facts = [');
  if (start < 0) return '';
  const end = toml.indexOf('\n]', start);
  return end < 0 ? '' : toml.slice(start, end);
};

describe('the process rules from retrospectives', () => {
  it('AGENTS.md states each one after the managed block', () => {
    const section = processSection(read('AGENTS.md'));
    expect(section, 'no "## Process rules from retrospectives" after <!-- /bmad:context -->').not.toBe('');
    expect(AGENTS_RULES.filter((rule) => !section.includes(rule))).toEqual([]);
  });

  it('bmad-build.toml carries each one as a persistent fact, and on_complete asks for the verifier', () => {
    const toml = read('_bmad/custom/bmad-build.toml');
    const facts = persistentFacts(toml);
    expect(facts, 'no persistent_facts array in bmad-build.toml').not.toBe('');
    expect(BUILD_FACTS.filter((fact) => !facts.includes(fact))).toEqual([]);
    const open = toml.indexOf('\non_complete = """');
    expect(open, 'no on_complete in bmad-build.toml').toBeGreaterThan(-1);
    const onComplete = toml.slice(open, toml.indexOf('"""', open + '\non_complete = """'.length));
    expect(onComplete).toContain('whether an independent verifier has run on this spec');
  });

  it('refuses a section moved inside the managed block, and a fact moved out of the array', () => {
    const inside = '<!-- bmad:context -->\n## Process rules from retrospectives\n- x\n<!-- /bmad:context -->\n';
    expect(processSection(inside)).toBe('');
    const after = '<!-- /bmad:context -->\n## Process rules from retrospectives\n- x\n## Next\n- y\n';
    expect(processSection(after)).toBe('## Process rules from retrospectives\n- x\n');
    expect(persistentFacts('# """Open inferences\n')).toBe('');
    expect(persistentFacts('a\npersistent_facts = [\n  """f""",\n]\nb = """g"""')).toContain('"""f"""');
    expect(persistentFacts('a\npersistent_facts = [\n  """f""",\n]\nb = """g"""')).not.toContain('"""g"""');
  });
});
