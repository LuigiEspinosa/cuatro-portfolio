import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HEADER, parseRows, summarise, analyse, render, scalars, quantile, main, SummaryError } from '../capacity-summary.mjs';
import { parseGate } from '../capacity-gate.mjs';

// The summariser is a `.mjs` file, which `tsconfig.json` excludes from
// typechecking, so this file is where its contract is actually asserted. Every
// case below is one row of the spec's I/O and edge-case matrix, built on fixture
// CSV strings rather than on a file, so nothing here depends on the box.

// `load1` and `load5` are deliberately different from `load15` and from each
// other. Written as three copies of one value, a transposition of the three load
// columns in either the sampler or the parser would leave every assertion in
// this file green while the record reported a one-minute average as the
// fifteen-minute one the gate is derived from.
const box = (ts: string, some: number, mem: number, load15: number) =>
  `${ts},box,_box,,,${some},0,${mem},${(load15 + 0.2).toFixed(2)},${(load15 + 0.1).toFixed(2)},${load15},`;

const container = (ts: string, name: string, cgroup: string, usage: number, some: number, mem: number) =>
  `${ts},container,${name},${cgroup},${usage},${some},0,${mem},,,,`;

const sampler = (ts: string, usec: number, rss: number) =>
  `${ts},sampler,_sampler,,${usec},,,${rss},,,,per run total and not cumulative`;

const note = (ts: string, text: string) => `${ts},note,,,,,,,,,,${text}`;

const csv = (...lines: string[]) => [HEADER, ...lines, ''].join('\n');

/** `2026-08-17T20:00:00Z` plus `minute` minutes, which is how every fixture names a sample. */
const at = (minute: number) => new Date(Date.parse('2026-08-17T20:00:00Z') + minute * 60000).toISOString().replace(/\.\d{3}Z$/, 'Z');

const GIB = 1024 * 1024 * 1024;
const MIB = 1024 * 1024;

const model = (text: string) => summarise(parseRows(text, 'fixture.csv'));

// ---------------------------------------------------------------------------
// Matrix row 1: a normal sample.
// ---------------------------------------------------------------------------

describe('a normal sample', () => {
  // Fourteen containers is what the box actually runs, so the fixture is that
  // shape rather than a convenient two.
  const names = Array.from({ length: 14 }, (_value, index) => `app-${String(index + 1).padStart(2, '0')}`);
  const sample = (minute: number) => [
    box(at(minute), 1_000_000 * minute, 6 * GIB, 0.1 + minute * 0.05),
    ...names.map((name, index) =>
      container(at(minute), name, `cg-${index}`, 60_000 * minute * (index + 1), 1000 * minute, (index + 1) * 10 * MIB)
    ),
    sampler(at(minute), 88_000, 10 * MIB),
  ];
  const text = csv(...sample(0), ...sample(1), ...sample(2));

  it('parses one box row, one row per container and one sampler row per run', () => {
    const rows = parseRows(text, 'fixture.csv');
    expect(rows.filter((row) => row.kind === 'box')).toHaveLength(3);
    expect(rows.filter((row) => row.kind === 'container')).toHaveLength(42);
    expect(rows.filter((row) => row.kind === 'sampler')).toHaveLength(3);
  });

  it('gives every row in a run the same timestamp, so a container reading and load15 are one sample', () => {
    const rows = parseRows(text, 'fixture.csv').filter((row) => row.ts === at(1));
    expect(rows).toHaveLength(16);
    expect(new Set(rows.map((row) => row.ts)).size).toBe(1);
    const boxRow = rows.find((row) => row.kind === 'box');
    expect(boxRow?.load15).not.toBeNull();
    // AD-9 names per-container cpu.pressure as the attribution diagnostic, so a
    // container row without one is not a sample this summariser should accept.
    for (const row of rows.filter((entry) => entry.kind === 'container')) {
      expect(row.usage).not.toBeNull();
      expect(row.some).not.toBeNull();
    }
  });

  it('summarises every container, infrastructure included, and reports no anomalies', () => {
    const summary = model(text);
    expect(summary.overall.containers).toHaveLength(14);
    expect(summary.overall.anomalies).toEqual([]);
    expect(summary.overall.missedSamples).toBe(0);
    expect(summary.overall.gaps).toEqual([]);
    expect(summary.overall.notes).toEqual([]);
  });

  it('derives a per-core rate from elapsed time, and a box share from the core count', () => {
    const summary = model(text);
    const first = summary.overall.containers.find((entry) => entry.name === 'app-01');
    // 60000 usec of CPU per 60 second interval is 0.1% of one core.
    expect(first?.cpuMeanCore).toBeCloseTo(0.001, 6);
    expect(first?.cpuMeanBox).toBeCloseTo(0.0005, 6);
    expect(summary.overall.cores).toBe(2);
  });

  it('states the sampler cost it observed rather than asserting it is small', () => {
    const summary = model(text);
    expect(summary.overall.sampler.measuredRuns).toBe(3);
    expect(summary.overall.sampler.meanUsec).toBe(88_000);
    expect(summary.overall.sampler.shareOfCore).not.toBeNull();
    expect(render(summary)).toContain('Observed, not assumed.');
  });
});

// ---------------------------------------------------------------------------
// Matrix row 2: a container is recreated, so its cgroup changes and its
// counters restart at zero.
// ---------------------------------------------------------------------------

describe('a container recreated mid run', () => {
  const text = csv(
    box(at(0), 0, 6 * GIB, 0.1),
    container(at(0), 'web', 'cg-old', 1_000_000, 0, 100 * MIB),
    box(at(1), 0, 6 * GIB, 0.2),
    container(at(1), 'web', 'cg-old', 7_000_000, 0, 100 * MIB),
    // The deploy lands here. Same name, new cgroup, counters from zero.
    box(at(2), 0, 6 * GIB, 0.3),
    container(at(2), 'web', 'cg-new', 100_000, 0, 100 * MIB),
    box(at(3), 0, 6 * GIB, 0.4),
    container(at(3), 'web', 'cg-new', 300_000, 0, 100 * MIB)
  );
  const summary = model(text);
  const web = summary.overall.containers.find((entry) => entry.name === 'web');

  it('segments on (container, cgroup) rather than on the name', () => {
    expect(web?.segments).toBe(2);
    expect(web?.samples).toBe(4);
    expect(summary.overall.redeployed).toEqual(['web']);
  });

  it('never emits a negative delta, and never clamps one either', () => {
    expect(summary.overall.anomalies).toEqual([]);
    // Three timestamps could have produced intervals; only two do, because the
    // boundary between the two cgroups is not an interval at all.
    expect(web?.intervals).toBe(2);
    expect(web?.cpuMeanCore).toBeGreaterThan(0);
  });

  it('keeps the busy segment rather than averaging the reset away', () => {
    // 6e6 usec over 60s, then 2e5 usec over 60s. The mean divides the two
    // in-segment totals by the two in-segment intervals, and the peak is the
    // busy one rather than a number flattened by the reset.
    expect(web?.cpuMeanCore).toBeCloseTo(6_200_000 / 120_000_000, 8);
    expect(web?.cpuPeakCore).toBeCloseTo(0.1, 8);
    expect(web?.cpuPeakAt).toBe(at(1));
  });

  it('says in the record that the container was recreated', () => {
    expect(render(summary)).toContain('recreated during the run');
  });
});

// ---------------------------------------------------------------------------
// Matrix row 3: samples are missed, so the gap is wider than one interval.
// ---------------------------------------------------------------------------

describe('missed samples', () => {
  const text = csv(
    box(at(0), 0, 6 * GIB, 0.1),
    container(at(0), 'web', 'cg', 0, 0, 100 * MIB),
    box(at(1), 0, 6 * GIB, 0.2),
    container(at(1), 'web', 'cg', 6_000_000, 0, 100 * MIB),
    // Four minutes with nothing recorded.
    box(at(5), 0, 6 * GIB, 0.3),
    container(at(5), 'web', 'cg', 30_000_000, 0, 100 * MIB)
  );
  const summary = model(text);

  it('divides by the real elapsed time, not by the nominal interval', () => {
    const web = summary.overall.containers.find((entry) => entry.name === 'web');
    // 24e6 usec across 240 seconds is 10% of one core. Divided by the nominal
    // 60 seconds it would have read as 40%, which is the failure this guards.
    const across = 24_000_000 / 240_000_000;
    expect(web?.cpuPeakCore).toBeCloseTo(Math.max(0.1, across), 8);
    expect(web?.cpuMeanCore).toBeCloseTo(30_000_000 / 300_000_000, 8);
  });

  it('reports the gap rather than smoothing it', () => {
    expect(summary.overall.gaps).toHaveLength(1);
    expect(summary.overall.gaps[0].seconds).toBe(240);
    expect(summary.overall.gapSeconds).toBe(240);
    expect(summary.overall.expectedBoxSamples).toBe(6);
    expect(summary.overall.missedSamples).toBe(3);
  });

  it('states the gap per day in the rendered record', () => {
    const out = render(summary);
    expect(out).toContain('samples were missed');
    expect(out).toContain('Longest gap 240 seconds');
  });

  it('counts coverage in minutes rather than claiming a week, and leaves the gap out of it', () => {
    // Three samples over a five minute span. Only the first pair was a real
    // minute of observation, and the pair spanning the gap contributes one
    // interval rather than the four minutes nobody watched.
    expect(summary.overall.spanMinutes).toBe(5);
    expect(summary.overall.coveredMinutes).toBe(2);
    expect(render(summary)).toContain('Coverage is 2 minutes');
  });

  it('never reports more coverage than the span it ran over', () => {
    expect(summary.overall.coveredMinutes).toBeLessThanOrEqual(summary.overall.spanMinutes);
    // The case that produced the contradiction on real data: the sampler was run
    // once by hand and the timer then fired 18 seconds later, so two samples
    // landed inside one minute.
    const clustered = model(
      csv(
        box('2026-08-17T20:59:34Z', 0, 6 * GIB, 0.1),
        box('2026-08-17T20:59:52Z', 0, 6 * GIB, 0.1),
        box('2026-08-17T21:00:52Z', 0, 6 * GIB, 0.1)
      )
    );
    expect(clustered.overall.box.samples).toBe(3);
    expect(clustered.overall.coveredMinutes).toBeLessThanOrEqual(clustered.overall.spanMinutes);
    expect(clustered.overall.coveredMinutes).toBeCloseTo(78 / 60, 8);
  });

  // `OnUnitActiveSec=60` measures from the previous activation, so a cycle is 60
  // seconds plus the run's own duration and every sample lands slightly later
  // than the one before. Against a nominal grid that drift counted as absent
  // samples: a real 219-sample run reported 2 missed with 0 gaps, and a full week
  // reported 151. Both numbers were wrong and both appeared in the sentence that
  // also said no gap existed.
  it('counts no missed samples when the timer merely drifts, because drift loses nothing', () => {
    const drifted = Array.from({ length: 60 }, (_value, index) =>
      // 60.9 seconds a cycle, which is the shape the box actually produces.
      box(new Date(Date.parse(at(0)) + index * 60_900).toISOString().replace(/\.\d{3}Z$/, 'Z'), 0, 6 * GIB, 0.1)
    );
    const summary = model(csv(...drifted));
    expect(summary.overall.box.samples).toBe(60);
    expect(summary.overall.gaps).toHaveLength(0);
    expect(summary.overall.missedSamples).toBe(0);
    expect(summary.overall.expectedBoxSamples).toBe(60);
    expect(render(summary)).toContain('No samples were missed.');
  });

  it('never claims a missed sample without a gap to evidence it', () => {
    const unbroken = model(csv(...Array.from({ length: 10 }, (_value, index) => box(at(index), 0, 6 * GIB, 0.1))));
    for (const candidate of [unbroken, summary]) {
      if (candidate.overall.missedSamples > 0) expect(candidate.overall.gaps.length).toBeGreaterThan(0);
      if (candidate.overall.gaps.length === 0) expect(candidate.overall.missedSamples).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Matrix row 4: a container id absent from the earlier samples appears.
// ---------------------------------------------------------------------------

describe('a new container appears part way through', () => {
  const text = csv(
    box(at(0), 0, 6 * GIB, 0.1),
    container(at(0), 'old', 'cg-old', 0, 0, 100 * MIB),
    box(at(1), 0, 6 * GIB, 0.2),
    container(at(1), 'old', 'cg-old', 6_000_000, 0, 100 * MIB),
    box(at(2), 0, 6 * GIB, 0.3),
    container(at(2), 'old', 'cg-old', 12_000_000, 0, 100 * MIB),
    container(at(2), 'fresh', 'cg-fresh', 0, 0, 50 * MIB),
    box(at(3), 0, 6 * GIB, 0.4),
    container(at(3), 'old', 'cg-old', 18_000_000, 0, 100 * MIB),
    container(at(3), 'fresh', 'cg-fresh', 1_200_000, 0, 50 * MIB)
  );
  const summary = model(text);

  it('includes it from its first sample rather than dropping it', () => {
    const fresh = summary.overall.containers.find((entry) => entry.name === 'fresh');
    expect(fresh).toBeDefined();
    expect(fresh?.firstTs).toBe(at(2));
    expect(fresh?.cpuMeanCore).toBeCloseTo(1_200_000 / 60_000_000, 8);
  });

  it('states the partial coverage instead of implying a full span', () => {
    const fresh = summary.overall.containers.find((entry) => entry.name === 'fresh');
    const old = summary.overall.containers.find((entry) => entry.name === 'old');
    expect(fresh?.partial).toBe(true);
    expect(old?.partial).toBe(false);
    const out = render(summary);
    expect(out).toContain('not present for the whole span');
    expect(out).toContain('`fresh` from 2026-08-17T20:02:00Z');
  });

  it('sums container memory per timestamp rather than summing per-container means', () => {
    // At the two later timestamps the estate holds 150 MiB, at the two earlier
    // ones 100 MiB. The mean is the mean of the four totals.
    expect(summary.overall.rss.peak).toBe(150 * MIB);
    expect(summary.overall.rss.mean).toBe(125 * MIB);
  });
});

// ---------------------------------------------------------------------------
// Matrix row 5: `docker ps` failed during a sample.
// ---------------------------------------------------------------------------

describe('docker unreachable during a sample', () => {
  const text = csv(
    box(at(0), 0, 6 * GIB, 0.1),
    container(at(0), 'web', 'cg', 0, 0, 100 * MIB),
    // The middle sample has a box row and a note, and no container rows.
    box(at(1), 0, 6 * GIB, 0.2),
    note(at(1), 'docker unreachable so container rows were skipped'),
    box(at(2), 0, 6 * GIB, 0.3),
    container(at(2), 'web', 'cg', 12_000_000, 0, 100 * MIB)
  );
  const summary = model(text);

  it('keeps the box row, so the box is measured even when attribution is not', () => {
    expect(summary.overall.box.samples).toBe(3);
    expect(summary.overall.box.load15.max).toBe(0.3);
  });

  it('carries the sampler note through to the record rather than hiding it', () => {
    expect(summary.overall.notes).toEqual([
      { ts: at(1), note: 'docker unreachable so container rows were skipped' },
    ]);
    expect(render(summary)).toContain('docker unreachable so container rows were skipped');
  });

  it('bridges the missing minute at the real elapsed time, not at the nominal one', () => {
    const web = summary.overall.containers.find((entry) => entry.name === 'web');
    expect(web?.intervals).toBe(1);
    expect(web?.cpuMeanCore).toBeCloseTo(12_000_000 / 120_000_000, 8);
  });

  it('accepts a note row as a row kind, so a sample with one is not a parse failure', () => {
    expect(() => parseRows(text, 'fixture.csv')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Matrix row 6: a segment with fewer than two samples.
// ---------------------------------------------------------------------------

describe('a segment seen exactly once', () => {
  const text = csv(
    box(at(0), 0, 6 * GIB, 0.1),
    container(at(0), 'steady', 'cg', 0, 0, 100 * MIB),
    box(at(1), 0, 6 * GIB, 0.2),
    container(at(1), 'steady', 'cg', 6_000_000, 0, 100 * MIB),
    container(at(1), 'blink', 'cg-blink', 9_999_999, 0, 20 * MIB)
  );
  const summary = model(text);
  const blink = summary.overall.containers.find((entry) => entry.name === 'blink');

  it('emits no rate for it, and never divides by zero', () => {
    expect(blink?.rateless).toBe(true);
    expect(blink?.intervals).toBe(0);
    expect(blink?.cpuMeanCore).toBeNull();
    expect(blink?.cpuPeakCore).toBeNull();
    expect(blink?.psiSome).toBeNull();
  });

  it('still counts its memory, which is a gauge and needs no second sample', () => {
    expect(blink?.memMean).toBe(20 * MIB);
    expect(blink?.memPeak).toBe(20 * MIB);
  });

  it('says so in the record rather than leaving a silent blank', () => {
    expect(summary.overall.singleSampleSegments).toEqual([{ name: 'blink', cgroup: 'cg-blink', ts: at(1) }]);
    const out = render(summary);
    expect(out).toContain('single sample, no rate');
    expect(out).toContain('appear in exactly one sample and produce no rate at all');
  });

  it('renders no NaN and no Infinity anywhere', () => {
    const out = render(summary);
    expect(out).not.toMatch(/NaN/);
    expect(out).not.toMatch(/Infinity/);
  });
});

// ---------------------------------------------------------------------------
// Matrix row 7: empty input.
// ---------------------------------------------------------------------------

describe('empty input', () => {
  it('fails loudly on a file with a header and no samples, naming the file', () => {
    expect(() => parseRows(csv(), 'capacity-2026-08-18.csv')).toThrow(SummaryError);
    expect(() => parseRows(csv(), 'capacity-2026-08-18.csv')).toThrow(/capacity-2026-08-18\.csv/);
    expect(() => parseRows(csv(), 'capacity-2026-08-18.csv')).toThrow(/header and no samples/);
  });

  it('fails loudly on a file with nothing in it at all', () => {
    expect(() => parseRows('', 'capacity-2026-08-18.csv')).toThrow(/the file is empty/);
  });

  it('exits non-zero from the command line rather than printing an empty report', () => {
    const result = main(['capacity-2026-08-18.csv'], () => csv());
    expect(result.ok).toBe(false);
    expect(result.message).toContain('capacity-2026-08-18.csv');
  });
});

// ---------------------------------------------------------------------------
// The schema is a contract, because the sampler and the summariser are
// installed in two different places and can drift apart.
// ---------------------------------------------------------------------------

describe('the schema the sampler writes', () => {
  // The sampler is the one component installed outside the repository and the
  // one file `tsconfig.json` cannot typecheck, so without this the two copies of
  // the schema were pinned only by prose. A rename in the shell script, or a
  // comma added to any row template, would have produced a week of files this
  // parser refuses wholesale, and CI would have stayed green until close-out day
  // with seven days of data already written.
  const sampler = readFileSync(resolve(process.cwd(), 'ops/capacity-sampler.sh'), 'utf8');

  it('is the same schema the shell script writes, read out of the script itself', () => {
    const declared = /^SCHEMA='([^']+)'$/m.exec(sampler);
    expect(declared, 'ops/capacity-sampler.sh must declare SCHEMA=\'...\' on one line').not.toBeNull();
    expect(declared?.[1]).toBe(HEADER);
  });

  it('is written by every row template in the script with exactly twelve fields', () => {
    const templates = [...sampler.matchAll(/^\s*rows\+=\("(.*)"\)$/gm)].map((match) => match[1]);
    // Box, docker-unreachable note, container, vanished note, sampler.
    expect(templates.length).toBeGreaterThanOrEqual(5);
    for (const template of templates) {
      // A `${...}` expansion cannot contain a comma: the script sanitises the
      // only field that comes from outside it. So counting commas on the raw
      // template counts the row's fields.
      expect(template.split(',')).toHaveLength(12);
    }
  });

  it('is twelve columns in a fixed order', () => {
    expect(HEADER.split(',')).toEqual([
      'ts',
      'kind',
      'name',
      'cgroup',
      'usage_usec',
      'psi_some_usec',
      'psi_full_usec',
      'memory_bytes',
      'load1',
      'load5',
      'load15',
      'note',
    ]);
  });

  it.each([
    ['a missing header', 'ts,kind\n2026-08-17T20:00:00Z,box\n', /expected the schema header/],
    ['a short row', `${HEADER}\n2026-08-17T20:00:00Z,box,_box\n`, /expected 12 fields, found 3/],
    ['a long row', `${HEADER}\n${box(at(0), 0, 1, 0.1)},extra\n`, /expected 12 fields, found 13/],
    ['a local timestamp', csv('2026-08-17 20:00:00,box,_box,,,0,0,1,0.1,0.1,0.1,'), /not an ISO 8601 UTC timestamp/],
    ['an unknown kind', csv('2026-08-17T20:00:00Z,widget,_box,,,0,0,1,0.1,0.1,0.1,'), /unknown kind "widget"/],
    ['a non numeric counter', csv('2026-08-17T20:00:00Z,box,_box,,,none,0,1,0.1,0.1,0.1,'), /psi_some_usec is not a number/],
    ['a negative counter, which a cumulative counter can never be', csv('2026-08-17T20:00:00Z,box,_box,,,-5,0,1,0.1,0.1,0.1,'), /psi_some_usec is not a number/],
  ])('refuses %s', (_label, text, expected) => {
    expect(() => parseRows(text, 'fixture.csv')).toThrow(expected);
  });

  it('names the offending line by number', () => {
    expect(() => parseRows(`${HEADER}\n${box(at(0), 0, 1, 0.1)}\nnonsense\n`, 'fixture.csv')).toThrow(
      /fixture\.csv line 3/
    );
  });

  it('tolerates CRLF and a byte order mark, since a CSV can be pulled onto Windows', () => {
    const text = csv(box(at(0), 0, 6 * GIB, 0.1));
    expect(parseRows(`﻿${text.replace(/\n/g, '\r\n')}`, 'fixture.csv')).toHaveLength(1);
  });

  it('drops a duplicate row, so a sample appended twice is not counted twice', () => {
    const line = box(at(0), 0, 6 * GIB, 0.1);
    const summary = model(csv(line, line, box(at(1), 0, 6 * GIB, 0.2)));
    expect(summary.overall.box.samples).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// The bands, and the two scalars the gate takes.
// ---------------------------------------------------------------------------

describe('the idle floor and the loaded band', () => {
  const text = csv(
    ...Array.from({ length: 20 }, (_value, index) => [
      box(at(index), 0, 6 * GIB, 0.1 + index * 0.1),
      container(at(index), 'web', 'cg', index * 6_000_000, index * 1_000_000, 100 * MIB),
    ]).flat()
  );
  const summary = model(text);

  it('reads both bands off the observed load15 rather than off a constant', () => {
    expect(summary.overall.bands.idleMax).toBeCloseTo(quantile([...Array(20)].map((_v, i) => 0.1 + i * 0.1).sort((a, b) => a - b), 0.1)!, 8);
    expect(summary.overall.bands.distinct).toBe(true);
    expect(summary.overall.bands.loadedMin).toBeGreaterThan(summary.overall.bands.idleMax!);
  });

  it('names which container dominates under load', () => {
    expect(summary.overall.bands.loaded.dominant).toBe('web');
    expect(render(summary)).toContain('Under load the three heaviest are');
  });

  it('says so plainly when the two bands are not distinct', () => {
    const flat = csv(
      box(at(0), 0, 6 * GIB, 0.1),
      container(at(0), 'web', 'cg', 0, 0, 100 * MIB),
      box(at(1), 0, 6 * GIB, 0.1),
      container(at(1), 'web', 'cg', 6_000_000, 0, 100 * MIB)
    );
    const flatSummary = model(flat);
    expect(flatSummary.overall.bands.distinct).toBe(false);
    expect(render(flatSummary)).toContain('The two bands are not distinct in this data.');
  });

  it('uses nearest rank, so every quantile printed is a load the box actually had', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2);
    expect(quantile([1, 2, 3, 4], 1)).toBe(4);
    expect(quantile([1, 2, 3, 4], 0)).toBe(1);
    expect(quantile([], 0.5)).toBeNull();
  });
});

describe('the two scalars ops/capacity-gate.yml takes', () => {
  const text = csv(
    ...Array.from({ length: 12 }, (_value, index) => [
      box(at(index), index * 500_000, 6 * GIB, 0.1 + index * 0.1),
      container(at(index), 'cs-tracker-app-1', 'cg', index * 6_000_000, index * 100_000, 200 * MIB),
      sampler(at(index), 88_000, 10 * MIB),
    ]).flat()
  );
  const values = scalars(model(text).overall);

  it('are single line scalars, because the gate reader refuses anything nested', () => {
    expect(values.baseline).not.toContain('\n');
    expect(values.reading).not.toContain('\n');
  });

  it('contain no "#", which the gate reader refuses because it strips no comments', () => {
    expect(values.baseline).not.toContain('#');
    expect(values.reading).not.toContain('#');
  });

  // The strongest available check that the two halves fit: build the gate the
  // close-out session would write and hand it to the gate's own reader.
  it('are accepted by ops/capacity-gate.mjs when pasted into the gate', () => {
    const gateText = [
      'measured_at: 2026-08-24',
      `baseline: ${values.baseline}`,
      'threshold:',
      `reading: ${values.reading}`,
      'status: blocked',
      'overflow:',
      '  path: managed hosting',
      '  provider: Railway',
      'placements:',
      '  - id: cuatro-portfolio',
      '    observed: 2026-08-17',
      '',
    ].join('\n');
    const gate = parseGate(gateText);
    expect(gate.baseline).toBe(values.baseline);
    expect(gate.reading).toBe(values.reading);
    expect(gate.status).toBe('blocked');
    expect(gate.threshold).toBe('');
  });

  // Asserts the invariant rather than the sentence. The wording used to name the
  // state the gate happened to be in on close-out day, which a later
  // re-derivation session would have been told to restore, and correcting it
  // then would have meant deleting an assertion rather than fixing a red test.
  // What is actually true in every era is that this tool emits neither key.
  it('never emits a threshold line and never emits a status line, in any era', () => {
    const out = render(model(text));
    expect(out).not.toMatch(/^threshold:/m);
    expect(out).not.toMatch(/^status:/m);
    expect(out).not.toMatch(/status: (open|blocked)/);
  });

  it('points the close-out session at the two files that know the gate state', () => {
    const out = render(model(text));
    expect(out).toContain('writes neither `threshold` nor `status`');
    expect(out).toContain('ops/capacity-gate.yml');
    expect(out).toContain('ops/capacity-threshold.md');
  });
});

// ---------------------------------------------------------------------------
// The command line, which is how the close-out session runs this.
// ---------------------------------------------------------------------------

describe('the command line', () => {
  const day = (date: string) =>
    [
      HEADER,
      `${date}T20:00:00Z,box,_box,,,0,0,${6 * GIB},0.1,0.1,0.1,`,
      `${date}T20:00:00Z,container,web,cg,0,0,0,${100 * MIB},,,,`,
      `${date}T20:01:00Z,box,_box,,,0,0,${6 * GIB},0.2,0.2,0.2,`,
      `${date}T20:01:00Z,container,web,cg,6000000,0,0,${100 * MIB},,,,`,
      '',
    ].join('\n');

  it('concatenates several days and reports them one per row', () => {
    const files: Record<string, string> = {
      'capacity-2026-08-17.csv': day('2026-08-17'),
      'capacity-2026-08-18.csv': day('2026-08-18'),
    };
    const result = main(['capacity-2026-08-17.csv', 'capacity-2026-08-18.csv'], (path: string) => files[path]);
    expect(result.ok).toBe(true);
    expect(result.message).toContain('### Per day');
    expect(result.message).toContain('| 2026-08-17 |');
    expect(result.message).toContain('| 2026-08-18 |');
  });

  it('refuses with usage when given no file', () => {
    const result = main([]);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('no input file was given');
  });

  it('reports an unreadable file rather than throwing', () => {
    const result = main(['missing.csv'], () => {
      throw new Error('ENOENT: no such file or directory');
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('missing.csv');
    expect(result.message).toContain('could not be read');
  });

  it.each([
    ['an unknown option', '--verbose', /unknown option --verbose/],
    ['a zero core count', '--cores=0', /--cores must be at least 1/],
    ['a zero interval', '--interval=0', /--interval must be at least 1/],
  ])('refuses %s', (_label, argument, expected) => {
    const result = main([argument, 'capacity-2026-08-17.csv'], () => day('2026-08-17'));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(expected);
  });

  it('honours a core count, so the box share is not hardcoded to two', () => {
    const rows = parseRows(day('2026-08-17'), 'fixture.csv');
    const two = analyse('two', rows, { cores: 2 });
    const four = analyse('four', rows, { cores: 4 });
    expect(two.total.cpuMeanCore).toBeCloseTo(four.total.cpuMeanCore!, 10);
    expect(four.total.cpuMeanBox).toBeCloseTo(two.total.cpuMeanBox! / 2, 10);
  });

  it('marks every figure in the record as observed or derived, so decided state is never observed state', () => {
    const out = render(model(day('2026-08-17')));
    expect(out).toContain('| **Observed** |');
    expect(out).toContain('| **Derived** |');
  });
});
