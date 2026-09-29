import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// AD-23: migrations run before a rollout while the previous version still serves, so each one either
// expands the schema (the old version keeps working) or contracts it (once no serving version reads
// what it removes), never both in one. `finance-migrate` in docker-compose.yml applies them.
const MIGRATIONS = join(__dirname, "..", "migrations");

// ponytail: a statement-level heuristic that holds the "never both in one" rule only. An expansion
// that still breaks the serving version (a NOT NULL column with no default, a new unique index) is
// not caught here and stays the migration author's to split. The four migrations merged in Story 3-5
// apply together to an empty database at placement, with no version serving.

const EXPANDS = [/^CREATE\b/, /\bADD COLUMN\b/];
const CONTRACTS = [
  /^DROP\b/,
  /\bDROP (COLUMN|CONSTRAINT|DEFAULT)\b/,
  /\bRENAME\b/,
  /\bSET NOT NULL\b/,
  /\bALTER COLUMN\b.*\bTYPE\b/,
];

function classify(sql: string) {
  const statements = sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim().toUpperCase())
    .filter(Boolean);
  return {
    expands: statements.some((s) => EXPANDS.some((re) => re.test(s))),
    contracts: statements.some((s) => CONTRACTS.some((re) => re.test(s))),
  };
}

describe("finance migrations", () => {
  const names = readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  it("finds the migrations, so the check below passes over something", () => {
    expect(names.length).toBeGreaterThan(0);
  });

  it.each(names)("%s expands or contracts the schema, never both", (name) => {
    const { expands, contracts } = classify(readFileSync(join(MIGRATIONS, name, "migration.sql"), "utf8"));
    expect(expands && contracts, `${name} both expands and contracts the schema (AD-23)`).toBe(false);
  });

  it("refuses a planted migration that does both", () => {
    expect(classify('ALTER TABLE "A" ADD COLUMN "b" TEXT;\nALTER TABLE "A" DROP COLUMN "c";')).toEqual({
      expands: true,
      contracts: true,
    });
    expect(classify('/* DROP COLUMN "x" */\nALTER TABLE "A" ADD COLUMN "b" TEXT;').contracts).toBe(false);
    expect(classify('ALTER TABLE "A" RENAME COLUMN "b" TO "c";').contracts).toBe(true);
  });
});
