// The capacity summariser (Story 1-5, AD-9). Turns the raw CSV that
// `ops/capacity-sampler.sh` writes on the box into the markdown block that goes
// into `ops/capacity-measurement.md`, plus the two scalars
// `ops/capacity-gate.yml` takes.
//
// No dependencies, deliberately, for the same reason `ops/capacity-gate.mjs`
// has none: this has to be runnable against a CSV pulled off the box with
// nothing installed but Node. It is committed rather than left on the box
// because a summariser outside the repository cannot be tested, and the
// arithmetic here is the part that turns counters into a number a gate will be
// written against.
//
// The three rules it exists to enforce:
//
//   1. Rates come from observed elapsed time, never from an assumed interval.
//      A missed minute widens the divisor and is reported, rather than being
//      silently averaged into the minutes around it.
//   2. A segment is `(container, cgroup)`, never `container`. A deploy recreates
//      a container under the same name with a new cgroup whose counters start at
//      zero. Keyed on the name alone that reset reads as a large negative delta,
//      and clamping it to zero would discard the busiest minutes of the week,
//      which are exactly the minutes a peak reading exists to capture.
//   3. The idle floor and the loaded band are percentiles of observed load15,
//      not a constant. Picking a load number here would smuggle in the judgement
//      that belongs to whoever derives the threshold. This tool summarises a
//      week and never decides what the box may hold: Story 1-6 derived the first
//      threshold from its output, and a later re-derivation works the same way.
//      `ops/capacity-threshold.md` is where that reasoning lives.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';

export const HEADER =
  'ts,kind,name,cgroup,usage_usec,psi_some_usec,psi_full_usec,memory_bytes,load1,load5,load15,note';

const COLUMNS = HEADER.split(',');
const KINDS = ['box', 'container', 'sampler', 'note'];
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const NUMBER = /^\d+(\.\d+)?$/;

// The nominal interval the timer is set to. Used only to decide what counts as
// a gap and what a complete day would have looked like. No rate is ever divided
// by it.
export const NOMINAL_INTERVAL_SEC = 60;

// Two vCPU, observed on the box. A share of one core above this many cores is
// impossible, so it is what turns a per-core share into a share of the box.
export const DEFAULT_CORES = 2;

const BYTES_PER_GIB = 1024 * 1024 * 1024;
const BYTES_PER_MIB = 1024 * 1024;

/** Thrown for input this summariser will not accept, never for a defect in it. */
export class SummaryError extends Error {}

/**
 * @typedef {{ ts: string, at: number, date: string, kind: string, name: string,
 *             cgroup: string, usage: number|null, some: number|null, full: number|null,
 *             memory: number|null, load1: number|null, load5: number|null,
 *             load15: number|null, note: string }} Row
 */

function fail(label, lineNumber, message) {
  throw new SummaryError(lineNumber === null ? `${label}: ${message}` : `${label} line ${lineNumber}: ${message}`);
}

function numberOrNull(raw, label, lineNumber, column) {
  if (raw === '') return null;
  if (!NUMBER.test(raw)) fail(label, lineNumber, `${column} is not a number: ${JSON.stringify(raw)}`);
  return Number(raw);
}

/**
 * Read one CSV file's text into rows, or throw. A file with a header and no data
 * rows throws too: zero rows is the one thing that must never summarise to an
 * empty but successful report.
 *
 * @param {string} text
 * @param {string} label the file name, so a failure names the file
 * @returns {Row[]}
 */
export function parseRows(text, label) {
  const lines = String(text).replace(/^﻿/, '').split('\n');
  const rows = [];
  let sawHeader = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/\r$/, '');
    const lineNumber = index + 1;
    if (line.trim() === '') continue;

    if (!sawHeader) {
      if (line !== HEADER) {
        fail(label, lineNumber, `expected the schema header. Found ${JSON.stringify(line)}`);
      }
      sawHeader = true;
      continue;
    }

    const fields = line.split(',');
    if (fields.length !== COLUMNS.length) {
      fail(label, lineNumber, `expected ${COLUMNS.length} fields, found ${fields.length}`);
    }

    const [ts, kind, name, cgroup, usage, some, full, memory, load1, load5, load15, note] = fields;
    if (!TIMESTAMP.test(ts)) fail(label, lineNumber, `not an ISO 8601 UTC timestamp: ${JSON.stringify(ts)}`);
    const at = Date.parse(ts);
    if (!Number.isFinite(at)) fail(label, lineNumber, `timestamp does not resolve: ${JSON.stringify(ts)}`);
    if (!KINDS.includes(kind)) {
      fail(label, lineNumber, `unknown kind ${JSON.stringify(kind)}. Accepted: ${KINDS.join(', ')}`);
    }

    rows.push({
      ts,
      at,
      date: ts.slice(0, 10),
      kind,
      name,
      cgroup,
      usage: numberOrNull(usage, label, lineNumber, 'usage_usec'),
      some: numberOrNull(some, label, lineNumber, 'psi_some_usec'),
      full: numberOrNull(full, label, lineNumber, 'psi_full_usec'),
      memory: numberOrNull(memory, label, lineNumber, 'memory_bytes'),
      load1: numberOrNull(load1, label, lineNumber, 'load1'),
      load5: numberOrNull(load5, label, lineNumber, 'load5'),
      load15: numberOrNull(load15, label, lineNumber, 'load15'),
      note,
    });
  }

  if (!sawHeader) fail(label, null, 'the file is empty. There is nothing to summarise');
  if (rows.length === 0) fail(label, null, 'the file has a header and no samples. There is nothing to summarise');
  return rows;
}

/**
 * Nearest rank, so every quantile reported is a load average the box actually
 * had. Interpolating would print a number that was never observed, which is the
 * wrong kind of number to derive a capacity threshold from.
 *
 * @param {number[]} sorted ascending
 * @param {number} p between 0 and 1
 */
export function quantile(sorted, p) {
  if (sorted.length === 0) return null;
  if (p <= 0) return sorted[0];
  const rank = Math.ceil(p * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

function mean(values) {
  if (values.length === 0) return null;
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}

function maxOf(values) {
  if (values.length === 0) return null;
  let best = values[0];
  for (const value of values) if (value > best) best = value;
  return best;
}

function dedupe(rows) {
  const seen = new Set();
  const kept = [];
  for (const row of rows) {
    const key = `${row.kind}\u0000${row.name}\u0000${row.cgroup}\u0000${row.ts}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(row);
  }
  return kept;
}

/**
 * The intervals of one `(container, cgroup)` segment. A segment boundary is not
 * an interval, so a counter reset never produces a data point at all.
 */
function segmentIntervals(rows, gapMs, anomalies) {
  const intervals = [];
  for (let index = 1; index < rows.length; index += 1) {
    const before = rows[index - 1];
    const after = rows[index];
    const dtMs = after.at - before.at;
    if (dtMs <= 0) continue;
    if (before.usage === null || after.usage === null) continue;

    const dUsage = after.usage - before.usage;
    if (dUsage < 0) {
      // Segmenting on the cgroup should make this unreachable. If it happens the
      // interval is dropped and counted, never clamped, because a clamp would
      // quietly turn a broken counter into a plausible reading.
      anomalies.push(`${after.name} at ${after.ts}: usage_usec fell within one cgroup`);
      continue;
    }

    let dSome = null;
    if (before.some !== null && after.some !== null && after.some >= before.some) {
      dSome = after.some - before.some;
    }

    const dtUsec = dtMs * 1000;
    intervals.push({
      name: after.name,
      cgroup: after.cgroup,
      endTs: after.ts,
      dtUsec,
      dUsage,
      dSome,
      cpuCore: dUsage / dtUsec,
      psiShare: dSome === null ? null : dSome / dtUsec,
      gap: dtMs > gapMs,
    });
  }
  return intervals;
}

function bandTotals(intervals, timestamps, cores) {
  const chosen = intervals.filter((interval) => timestamps.has(interval.endTs));
  const byName = new Map();
  let totalUsage = 0;
  let coveredUsec = 0;
  for (const interval of chosen) {
    const entry = byName.get(interval.name) ?? { name: interval.name, usage: 0, covered: 0 };
    entry.usage += interval.dUsage;
    entry.covered += interval.dtUsec;
    byName.set(interval.name, entry);
    totalUsage += interval.dUsage;
    coveredUsec += interval.dtUsec;
  }

  // Wall time is counted once per timestamp, not once per container, or a box
  // with fourteen containers would look fourteen times longer than it is.
  const wallUsec = new Set(chosen.map((interval) => interval.endTs)).size === 0
    ? 0
    : chosen
        .filter((interval, index, all) => all.findIndex((other) => other.endTs === interval.endTs) === index)
        .reduce((total, interval) => total + interval.dtUsec, 0);

  const ranked = [...byName.values()].sort((a, b) => b.usage - a.usage);
  return {
    intervalCount: chosen.length,
    sampleCount: new Set(chosen.map((interval) => interval.endTs)).size,
    cpuCore: wallUsec === 0 ? null : totalUsage / wallUsec,
    cpuBox: wallUsec === 0 ? null : totalUsage / wallUsec / cores,
    dominant: ranked.length === 0 ? null : ranked[0].name,
    dominantCore: ranked.length === 0 || ranked[0].covered === 0 ? null : ranked[0].usage / ranked[0].covered,
    ranked: ranked.slice(0, 3).map((entry) => ({
      name: entry.name,
      cpuCore: entry.covered === 0 ? null : entry.usage / entry.covered,
    })),
    coveredUsec,
    wallUsec,
  };
}

/**
 * Everything derived from one set of rows. Called once per UTC day and once over
 * the whole run, so a day and the week are computed by the same code and cannot
 * disagree about what a mean is.
 *
 * @param {string} label
 * @param {Row[]} input
 * @param {{ cores?: number, intervalSec?: number }} [options]
 */
export function analyse(label, input, options = {}) {
  const cores = options.cores ?? DEFAULT_CORES;
  const intervalSec = options.intervalSec ?? NOMINAL_INTERVAL_SEC;
  const gapMs = intervalSec * 1000 * 2;
  const rows = dedupe(input).sort((a, b) => a.at - b.at || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));

  const boxRows = rows.filter((row) => row.kind === 'box');
  const containerRows = rows.filter((row) => row.kind === 'container');
  const samplerRows = rows.filter((row) => row.kind === 'sampler');
  const noteRows = rows.filter((row) => row.kind === 'note');

  const firstTs = rows.length === 0 ? null : rows[0].ts;
  const lastTs = rows.length === 0 ? null : rows[rows.length - 1].ts;
  const spanMs = rows.length === 0 ? 0 : rows[rows.length - 1].at - rows[0].at;

  // --- the box ---------------------------------------------------------------

  const load15 = boxRows.map((row) => row.load15).filter((value) => value !== null);
  const sortedLoad = [...load15].sort((a, b) => a - b);
  const box = {
    samples: boxRows.length,
    load15: {
      min: sortedLoad.length === 0 ? null : sortedLoad[0],
      p10: quantile(sortedLoad, 0.1),
      p50: quantile(sortedLoad, 0.5),
      p90: quantile(sortedLoad, 0.9),
      p99: quantile(sortedLoad, 0.99),
      max: sortedLoad.length === 0 ? null : sortedLoad[sortedLoad.length - 1],
    },
    memAvailable: {
      min: sortedLoad.length === 0 ? null : Math.min(...boxRows.map((row) => row.memory ?? Infinity)),
      mean: mean(boxRows.map((row) => row.memory).filter((value) => value !== null)),
    },
    psiSome: null,
  };
  if (box.memAvailable.min === Infinity) box.memAvailable.min = null;

  let boxPsiDelta = 0;
  let boxPsiWall = 0;
  const gaps = [];
  // Coverage is the time actually bracketed by two consecutive box samples, and
  // a pair contributes at most one nominal interval. Counting one interval per
  // sample instead would let a run that fired twice inside a minute report more
  // coverage than the span it ran over, which is a headline number that
  // contradicts itself. Capping each pair also keeps the missing minutes of a
  // gap out of coverage rather than counting them as observed.
  let coveredMs = 0;
  for (let index = 1; index < boxRows.length; index += 1) {
    const before = boxRows[index - 1];
    const after = boxRows[index];
    const dtMs = after.at - before.at;
    if (dtMs <= 0) continue;
    coveredMs += Math.min(dtMs, intervalSec * 1000);
    if (dtMs > gapMs) gaps.push({ from: before.ts, to: after.ts, seconds: Math.round(dtMs / 1000) });
    if (before.some !== null && after.some !== null && after.some >= before.some) {
      boxPsiDelta += after.some - before.some;
      boxPsiWall += dtMs * 1000;
    }
  }
  box.psiSome = boxPsiWall === 0 ? null : boxPsiDelta / boxPsiWall;

  // A missed sample is evidenced by a gap, never by a nominal grid.
  // `OnUnitActiveSec=60` measures the interval from the previous activation, so
  // every cycle is 60 seconds plus that run's own duration and the samples drift
  // steadily later. Counted against `floor(span / interval) + 1`, that drift
  // alone reported 151 absent samples over a week in which nothing was absent,
  // in the same sentence as "0 gaps totalling 0 seconds". Expected is therefore
  // derived from what was observed plus what a gap proves is missing, so the two
  // halves of that sentence can no longer contradict each other.
  const missedSamples = gaps.reduce(
    (total, gap) => total + Math.max(0, Math.round(gap.seconds / intervalSec) - 1),
    0
  );
  const expectedBoxSamples = boxRows.length + missedSamples;
  const gapSeconds = gaps.reduce((total, gap) => total + gap.seconds, 0);

  // --- the bands -------------------------------------------------------------

  const idleTs = new Set(
    boxRows.filter((row) => row.load15 !== null && box.load15.p10 !== null && row.load15 <= box.load15.p10).map((row) => row.ts)
  );
  const loadedTs = new Set(
    boxRows.filter((row) => row.load15 !== null && box.load15.p90 !== null && row.load15 >= box.load15.p90).map((row) => row.ts)
  );
  const bandsDistinct = box.load15.p10 !== null && box.load15.p90 !== null && box.load15.p90 > box.load15.p10;

  // --- the containers --------------------------------------------------------

  const segments = new Map();
  for (const row of containerRows) {
    const key = `${row.name}\u0000${row.cgroup}`;
    const bucket = segments.get(key) ?? [];
    bucket.push(row);
    segments.set(key, bucket);
  }

  const anomalies = [];
  const allIntervals = [];
  const singleSampleSegments = [];
  const byName = new Map();

  for (const [key, segmentRows] of segments) {
    const [name, cgroup] = key.split('\u0000');
    const sorted = [...segmentRows].sort((a, b) => a.at - b.at);
    const entry = byName.get(name) ?? {
      name,
      samples: 0,
      segments: 0,
      cgroups: [],
      intervals: [],
      memory: [],
      firstTs: sorted[0].ts,
      lastTs: sorted[sorted.length - 1].ts,
    };
    entry.samples += sorted.length;
    entry.segments += 1;
    entry.cgroups.push(cgroup);
    for (const row of sorted) if (row.memory !== null) entry.memory.push(row.memory);
    if (sorted[0].ts < entry.firstTs) entry.firstTs = sorted[0].ts;
    if (sorted[sorted.length - 1].ts > entry.lastTs) entry.lastTs = sorted[sorted.length - 1].ts;

    if (sorted.length < 2) {
      singleSampleSegments.push({ name, cgroup, ts: sorted[0].ts });
    } else {
      const intervals = segmentIntervals(sorted, gapMs, anomalies);
      entry.intervals.push(...intervals);
      allIntervals.push(...intervals);
    }
    byName.set(name, entry);
  }

  const boxFirstTs = boxRows.length === 0 ? firstTs : boxRows[0].ts;
  const boxLastTs = boxRows.length === 0 ? lastTs : boxRows[boxRows.length - 1].ts;

  const containers = [...byName.values()]
    .map((entry) => {
      const totalUsage = entry.intervals.reduce((total, interval) => total + interval.dUsage, 0);
      const covered = entry.intervals.reduce((total, interval) => total + interval.dtUsec, 0);
      const psiCovered = entry.intervals
        .filter((interval) => interval.dSome !== null)
        .reduce((total, interval) => total + interval.dtUsec, 0);
      const psiTotal = entry.intervals
        .filter((interval) => interval.dSome !== null)
        .reduce((total, interval) => total + interval.dSome, 0);
      const peakInterval = entry.intervals.reduce(
        (best, interval) => (best === null || interval.cpuCore > best.cpuCore ? interval : best),
        null
      );
      return {
        name: entry.name,
        samples: entry.samples,
        segments: entry.segments,
        intervals: entry.intervals.length,
        cpuMeanCore: covered === 0 ? null : totalUsage / covered,
        cpuMeanBox: covered === 0 ? null : totalUsage / covered / cores,
        cpuPeakCore: peakInterval === null ? null : peakInterval.cpuCore,
        cpuPeakBox: peakInterval === null ? null : peakInterval.cpuCore / cores,
        cpuPeakAt: peakInterval === null ? null : peakInterval.endTs,
        memMean: mean(entry.memory),
        memPeak: maxOf(entry.memory),
        psiSome: psiCovered === 0 ? null : psiTotal / psiCovered,
        psiPeak: maxOf(entry.intervals.map((interval) => interval.psiShare).filter((value) => value !== null)),
        firstTs: entry.firstTs,
        lastTs: entry.lastTs,
        partial: entry.firstTs > boxFirstTs || entry.lastTs < boxLastTs,
        rateless: entry.intervals.length === 0,
      };
    })
    .sort((a, b) => (b.cpuMeanCore ?? -1) - (a.cpuMeanCore ?? -1) || a.name.localeCompare(b.name));

  // Container memory is a gauge, so the estate's footprint is the sum across
  // containers at one timestamp, then averaged over timestamps. Summing the
  // per-container means would give the same number only if every container were
  // present in every sample, which is exactly what a redeploy breaks.
  const rssByTs = new Map();
  for (const row of containerRows) {
    if (row.memory === null) continue;
    rssByTs.set(row.ts, (rssByTs.get(row.ts) ?? 0) + row.memory);
  }
  const rssValues = [...rssByTs.values()];
  const rss = { mean: mean(rssValues), peak: maxOf(rssValues) };

  // Total container CPU per timestamp, so a peak is the box's busiest minute
  // rather than the busiest minute of any one container.
  const cpuByTs = new Map();
  for (const interval of allIntervals) {
    const entry = cpuByTs.get(interval.endTs) ?? { usage: 0, dtUsec: 0 };
    entry.usage += interval.dUsage;
    entry.dtUsec = Math.max(entry.dtUsec, interval.dtUsec);
    cpuByTs.set(interval.endTs, entry);
  }
  const totalShares = [...cpuByTs.values()]
    .filter((entry) => entry.dtUsec > 0)
    .map((entry) => entry.usage / entry.dtUsec);
  const totalUsageAll = [...cpuByTs.values()].reduce((total, entry) => total + entry.usage, 0);
  const totalWallAll = [...cpuByTs.values()].reduce((total, entry) => total + entry.dtUsec, 0);
  const total = {
    cpuMeanCore: totalWallAll === 0 ? null : totalUsageAll / totalWallAll,
    cpuMeanBox: totalWallAll === 0 ? null : totalUsageAll / totalWallAll / cores,
    cpuPeakCore: maxOf(totalShares),
    cpuPeakBox: maxOf(totalShares) === null ? null : maxOf(totalShares) / cores,
  };

  const idle = bandTotals(allIntervals, idleTs, cores);
  const loaded = bandTotals(allIntervals, loadedTs, cores);
  const idleLoad15 = mean(boxRows.filter((row) => idleTs.has(row.ts) && row.load15 !== null).map((row) => row.load15));
  const loadedLoad15 = mean(
    boxRows.filter((row) => loadedTs.has(row.ts) && row.load15 !== null).map((row) => row.load15)
  );
  const idleRss = mean([...rssByTs.entries()].filter(([ts]) => idleTs.has(ts)).map(([, value]) => value));
  const loadedRss = mean([...rssByTs.entries()].filter(([ts]) => loadedTs.has(ts)).map(([, value]) => value));

  // --- what the sampler cost -------------------------------------------------

  const samplerUsec = samplerRows.map((row) => row.usage).filter((value) => value !== null);
  const samplerTotal = samplerUsec.reduce((sum, value) => sum + value, 0);
  const sampler = {
    runs: samplerRows.length,
    measuredRuns: samplerUsec.length,
    meanUsec: mean(samplerUsec),
    peakUsec: maxOf(samplerUsec),
    peakRss: maxOf(samplerRows.map((row) => row.memory).filter((value) => value !== null)),
    // The share of one core the measurement itself consumed over the span it
    // covered. Stated rather than assumed to be negligible.
    shareOfCore: spanMs === 0 ? null : samplerTotal / (spanMs * 1000),
    shareOfBox: spanMs === 0 ? null : samplerTotal / (spanMs * 1000) / cores,
  };

  return {
    label,
    cores,
    intervalSec,
    firstTs,
    lastTs,
    spanMinutes: spanMs / 60000,
    coveredMinutes: coveredMs / 60000,
    box,
    expectedBoxSamples,
    missedSamples,
    gaps,
    gapSeconds,
    bands: {
      distinct: bandsDistinct,
      idleMax: box.load15.p10,
      loadedMin: box.load15.p90,
      idle: { ...idle, load15: idleLoad15, rss: idleRss },
      loaded: { ...loaded, load15: loadedLoad15, rss: loadedRss },
    },
    containers,
    total,
    rss,
    sampler,
    singleSampleSegments,
    anomalies,
    notes: noteRows.map((row) => ({ ts: row.ts, note: row.note })),
    redeployed: containers.filter((entry) => entry.segments > 1).map((entry) => entry.name),
  };
}

/**
 * @param {Row[]} rows
 * @param {{ cores?: number, intervalSec?: number }} [options]
 */
export function summarise(rows, options = {}) {
  const byDate = new Map();
  for (const row of rows) {
    const bucket = byDate.get(row.date) ?? [];
    bucket.push(row);
    byDate.set(row.date, bucket);
  }
  const days = [...byDate.keys()].sort().map((date) => analyse(date, byDate.get(date), options));
  return { days, overall: analyse('whole run', rows, options) };
}

// --- formatting --------------------------------------------------------------

function pct(value, digits = 1) {
  return value === null || value === undefined ? 'n/a' : `${(value * 100).toFixed(digits)}%`;
}

function gib(value) {
  return value === null || value === undefined ? 'n/a' : `${(value / BYTES_PER_GIB).toFixed(2)} GiB`;
}

function mib(value) {
  return value === null || value === undefined ? 'n/a' : `${(value / BYTES_PER_MIB).toFixed(0)} MiB`;
}

function load(value) {
  return value === null || value === undefined ? 'n/a' : value.toFixed(2);
}

function ms(value) {
  return value === null || value === undefined ? 'n/a' : `${(value / 1000).toFixed(0)} ms`;
}

function minutes(value) {
  const rounded = Number(value.toFixed(0));
  return `${rounded} ${rounded === 1 ? 'minute' : 'minutes'}`;
}

/**
 * The two lines `ops/capacity-gate.yml` takes. They are scalars because
 * `ops/capacity-gate.mjs` lists `baseline` and `reading` in `SCALAR_KEYS` and
 * refuses anything nested under them, so structured detail belongs in the
 * markdown above and never in the gate file.
 *
 * The reader also refuses a value containing a `#`, so nothing here may use one.
 *
 * @param {ReturnType<typeof analyse>} model
 */
export function scalars(model) {
  const idle = model.bands.idle;
  const loaded = model.bands.loaded;
  const baseline = [
    `idle band load15 ${load(idle.load15)}`,
    `containers ${pct(idle.cpuBox)} of ${model.cores} vCPU`,
    `${gib(idle.rss)} container RSS`,
    `measured over ${minutes(model.coveredMinutes)} to ${model.lastTs ?? 'n/a'}`,
  ].join(', ');
  const reading = [
    `loaded band load15 ${load(loaded.load15)} max ${load(model.box.load15.max)}`,
    `containers ${pct(loaded.cpuBox)} of ${model.cores} vCPU`,
    `peak ${pct(model.total.cpuPeakBox)}`,
    `top ${loaded.dominant ?? 'n/a'} at ${pct(loaded.dominantCore)} of one core`,
    `${gib(loaded.rss)} container RSS`,
  ].join(', ');
  return { baseline, reading };
}

function containerTable(model) {
  const lines = [
    '| Container | Samples | Segments | CPU mean (1 core) | CPU peak (1 core) | CPU mean (box) | Mem mean | Mem peak | PSI some | Coverage |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const entry of model.containers) {
    const coverage = entry.rateless
      ? 'single sample, no rate'
      : entry.partial
        ? `partial, ${entry.firstTs} to ${entry.lastTs}`
        : 'full';
    lines.push(
      `| \`${entry.name}\` | ${entry.samples} | ${entry.segments} | ${pct(entry.cpuMeanCore)} | ${pct(entry.cpuPeakCore)} | ${pct(entry.cpuMeanBox)} | ${mib(entry.memMean)} | ${mib(entry.memPeak)} | ${pct(entry.psiSome)} | ${coverage} |`
    );
  }
  return lines;
}

/**
 * The markdown block that goes into `ops/capacity-measurement.md`.
 *
 * @param {{ days: ReturnType<typeof analyse>[], overall: ReturnType<typeof analyse> }} summary
 */
export function render(summary) {
  const model = summary.overall;
  const out = [];

  out.push('## What the week measured');
  out.push('');
  out.push(
    `**Observed** from \`${model.firstTs}\` to \`${model.lastTs}\` UTC, a span of ${minutes(model.spanMinutes)}. ` +
      `${model.box.samples} box samples against ${model.expectedBoxSamples} expected at one sample every ` +
      `${model.intervalSec} seconds, bracketing ${minutes(model.coveredMinutes)} of observed time. ` +
      (model.missedSamples === 0
        ? 'No samples were missed.'
        : `${model.missedSamples} samples were missed, in ${model.gaps.length} gaps totalling ${model.gapSeconds} seconds.`)
  );
  out.push('');
  out.push(
    `Every share below is stated against **one core** and against the **whole box**, which is ${model.cores} vCPU. ` +
      'Rates come from the elapsed time between two samples of the same cgroup, never from the nominal interval.'
  );
  out.push('');

  out.push('### The box');
  out.push('');
  out.push('| Reading | Value | Nature |');
  out.push('|---|---|---|');
  out.push(`| load15 min | ${load(model.box.load15.min)} | **Observed** |`);
  out.push(`| load15 p10, the idle floor | ${load(model.box.load15.p10)} | **Observed** |`);
  out.push(`| load15 p50 | ${load(model.box.load15.p50)} | **Observed** |`);
  out.push(`| load15 p90, the loaded band | ${load(model.box.load15.p90)} | **Observed** |`);
  out.push(`| load15 p99 | ${load(model.box.load15.p99)} | **Observed** |`);
  out.push(`| load15 max | ${load(model.box.load15.max)} | **Observed** |`);
  out.push(`| MemAvailable mean | ${gib(model.box.memAvailable.mean)} | **Observed** |`);
  out.push(`| MemAvailable floor | ${gib(model.box.memAvailable.min)} | **Observed** |`);
  out.push(`| Box PSI some, share of wall time | ${pct(model.box.psiSome)} | **Observed** |`);
  out.push(`| All containers, CPU mean | ${pct(model.total.cpuMeanBox)} of the box | **Derived** |`);
  out.push(`| All containers, CPU peak in one interval | ${pct(model.total.cpuPeakBox)} of the box | **Derived** |`);
  out.push(`| All containers, RSS mean | ${gib(model.rss.mean)} | **Derived** |`);
  out.push(`| All containers, RSS peak | ${gib(model.rss.peak)} | **Derived** |`);
  out.push('');

  out.push('### Per container, whole run');
  out.push('');
  out.push(...containerTable(model));
  out.push('');

  out.push('### The idle floor and the loaded band');
  out.push('');
  out.push(
    'Both bands are percentiles of the load15 the box actually had, not thresholds chosen in advance. ' +
      'Idle is every sample at or below the tenth percentile, loaded every sample at or above the ninetieth.'
  );
  out.push('');
  if (!model.bands.distinct) {
    out.push(
      '**The two bands are not distinct in this data.** The tenth and ninetieth percentiles of load15 are the ' +
        'same value, so every sample falls in both bands and the two rows below describe the same minutes. ' +
        'That is a statement about how little the load varied over the covered span, and a longer span is the fix.'
    );
    out.push('');
  }
  out.push('| Band | load15 | Samples | Containers, CPU | Container RSS | Dominant container |');
  out.push('|---|---|---|---|---|---|');
  out.push(
    `| Idle, load15 at or below ${load(model.bands.idleMax)} | ${load(model.bands.idle.load15)} | ${model.bands.idle.sampleCount} | ${pct(model.bands.idle.cpuBox)} of the box | ${gib(model.bands.idle.rss)} | ${model.bands.idle.dominant ?? 'n/a'} |`
  );
  out.push(
    `| Loaded, load15 at or above ${load(model.bands.loadedMin)} | ${load(model.bands.loaded.load15)} | ${model.bands.loaded.sampleCount} | ${pct(model.bands.loaded.cpuBox)} of the box | ${gib(model.bands.loaded.rss)} | ${model.bands.loaded.dominant ?? 'n/a'} |`
  );
  out.push('');
  if (model.bands.loaded.ranked.length > 0) {
    out.push(
      `Under load the three heaviest are ${model.bands.loaded.ranked
        .map((entry) => `\`${entry.name}\` at ${pct(entry.cpuCore)} of one core`)
        .join(', ')}.`
    );
    out.push('');
  }

  out.push('### What the measurement cost');
  out.push('');
  out.push(
    `**Observed, not assumed.** The sampler recorded its own CPU time on each of ${model.sampler.measuredRuns} runs ` +
      `out of ${model.sampler.runs} rows. Mean ${ms(model.sampler.meanUsec)} of CPU per run, peak ${ms(model.sampler.peakUsec)}, ` +
      `peak RSS ${mib(model.sampler.peakRss)}. Over the covered span that is ${pct(model.sampler.shareOfCore, 3)} of one core ` +
      `and ${pct(model.sampler.shareOfBox, 3)} of the box.`
  );
  out.push('');

  if (summary.days.length > 1) {
    out.push('### Per day');
    out.push('');
    out.push('| Day | Box samples | Missed | load15 p50 | load15 max | Containers CPU mean | Containers CPU peak | RSS peak |');
    out.push('|---|---|---|---|---|---|---|---|');
    for (const day of summary.days) {
      out.push(
        `| ${day.label} | ${day.box.samples} | ${day.missedSamples} | ${load(day.box.load15.p50)} | ${load(day.box.load15.max)} | ${pct(day.total.cpuMeanBox)} | ${pct(day.total.cpuPeakBox)} | ${gib(day.rss.peak)} |`
      );
    }
    out.push('');
  }

  out.push('### What this summary does not claim');
  out.push('');
  const caveats = [];
  caveats.push(
    `Coverage is ${minutes(model.coveredMinutes)}, stated in minutes rather than as a week, because the number of ` +
      'minutes actually sampled is the only thing the data supports.'
  );
  if (model.gaps.length > 0) {
    caveats.push(
      `${model.gaps.length} gaps larger than ${model.intervalSec * 2} seconds. Rates across a gap divide by the real ` +
        `elapsed time, so nothing is smoothed, but no reading exists for the missing minutes. Longest gap ` +
        `${Math.max(...model.gaps.map((gap) => gap.seconds))} seconds, first at ${model.gaps[0].from}.`
    );
  }
  if (model.redeployed.length > 0) {
    caveats.push(
      `${model.redeployed.length} containers were recreated during the run (${model.redeployed
        .map((name) => `\`${name}\``)
        .join(', ')}). Each recreation starts a new segment, so no interval spans a counter reset.`
    );
  }
  if (model.singleSampleSegments.length > 0) {
    caveats.push(
      `${model.singleSampleSegments.length} segments appear in exactly one sample and produce no rate at all ` +
        `(${model.singleSampleSegments.map((entry) => `\`${entry.name}\` at ${entry.ts}`).join(', ')}). ` +
        'Their memory readings are counted; their CPU is not, because a single cumulative counter is not a rate.'
    );
  }
  const partial = model.containers.filter((entry) => entry.partial && !entry.rateless);
  if (partial.length > 0) {
    caveats.push(
      `${partial.length} containers were not present for the whole span and are summarised over the part they were ` +
        `present for (${partial.map((entry) => `\`${entry.name}\` from ${entry.firstTs}`).join(', ')}).`
    );
  }
  if (model.notes.length > 0) {
    caveats.push(
      `${model.notes.length} samples carry a note from the sampler, which means part of that sample is missing: ` +
        `${[...new Set(model.notes.map((note) => note.note))].join('; ')}.`
    );
  }
  if (model.anomalies.length > 0) {
    caveats.push(
      `${model.anomalies.length} intervals were dropped because a counter fell inside one cgroup, which should be ` +
        `impossible: ${model.anomalies.slice(0, 5).join('; ')}.`
    );
  }
  caveats.push(
    'The sampler is a guest on the box it measures, so every figure includes the sampler. Its cost is stated above ' +
      'rather than subtracted.'
  );
  caveats.push(
    'Load average is the box, and PSI plus cgroup CPU is the attribution. Neither says anything about what the box ' +
      'would do under traffic it did not receive.'
  );
  for (const caveat of caveats) {
    out.push(`- ${caveat}`);
    out.push('');
  }

  const values = scalars(model);
  out.push('### The two scalars `ops/capacity-gate.yml` takes');
  out.push('');
  out.push('Paste these two lines, and nothing nested, because `ops/capacity-gate.mjs` reads both as scalars.');
  out.push('');
  out.push('```');
  out.push(`baseline: ${values.baseline}`);
  out.push(`reading: ${values.reading}`);
  out.push('```');
  out.push('');
  // Deliberately says nothing about what `threshold` and `status` currently
  // hold. This tool is run by a close-out session, and the first one ran against
  // a gate that was blocked with an empty threshold while a later re-derivation
  // runs against a gate that is already open. An instruction naming one of those
  // states is wrong in the other, and the operator reading it has no way to tell
  // which era they are in. So point at the two files that always know.
  out.push(
    'This summariser writes neither `threshold` nor `status`, in any era. Both are judgement, not ' +
      'arithmetic over the week. The gate\'s current state is in `ops/capacity-gate.yml`, and how a ' +
      'threshold is derived, what authorises a status move and what re-blocks the gate are in ' +
      '`ops/capacity-threshold.md`. A re-derivation follows that record\'s re-block table.'
  );

  return out.join('\n');
}

// --- the command line --------------------------------------------------------

function usage() {
  return [
    'usage: node ops/capacity-summary.mjs [--cores=N] [--interval=SECONDS] <capacity-YYYY-MM-DD.csv>...',
    '',
    'Reads the raw CSV written by ops/capacity-sampler.sh and prints the markdown',
    'block for ops/capacity-measurement.md, plus the two scalars the gate takes.',
  ].join('\n');
}

/**
 * @param {string[]} argv
 * @param {(path: string, encoding: string) => string} [readFile]
 * @returns {{ ok: boolean, message: string }}
 */
export function main(argv, readFile = readFileSync) {
  const files = [];
  const options = {};
  for (const argument of argv) {
    if (typeof argument !== 'string') continue;
    const cores = /^--cores=(\d+)$/.exec(argument);
    if (cores) {
      options.cores = Number(cores[1]);
      if (options.cores < 1) return { ok: false, message: 'capacity summary: --cores must be at least 1' };
      continue;
    }
    const interval = /^--interval=(\d+)$/.exec(argument);
    if (interval) {
      options.intervalSec = Number(interval[1]);
      if (options.intervalSec < 1) return { ok: false, message: 'capacity summary: --interval must be at least 1' };
      continue;
    }
    if (argument.startsWith('--')) return { ok: false, message: `capacity summary: unknown option ${argument}\n\n${usage()}` };
    files.push(argument);
  }

  if (files.length === 0) return { ok: false, message: `capacity summary: no input file was given\n\n${usage()}` };

  const rows = [];
  for (const file of files) {
    let text;
    try {
      text = readFile(file, 'utf8');
    } catch (error) {
      return {
        ok: false,
        message: `capacity summary: ${file} could not be read: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    try {
      rows.push(...parseRows(text, file));
    } catch (error) {
      if (!(error instanceof SummaryError)) throw error;
      return { ok: false, message: `capacity summary: ${error.message}` };
    }
  }

  return { ok: true, message: render(summarise(rows, options)) };
}

function sameFile(a, b) {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return false;
  }
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && sameFile(process.argv[1], fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const result = main(process.argv.slice(2));
  const stream = result.ok ? process.stdout : process.stderr;
  stream.write(`${result.message}\n`, () => process.exit(result.ok ? 0 : 1));
}
