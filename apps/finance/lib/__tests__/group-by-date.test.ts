import { describe, it, expect } from "vitest";
import { groupByDate } from "../utils/group-by-date";
import type { Transaction } from "@/generated/prisma/client";

// Minimal transaction factory
function tx(id: string, transacted_at: Date): Transaction {
  return { id, transacted_at } as Transaction;
}

describe("groupByDate", () => {
  it("returns empty array for empty input", () => {
    expect(groupByDate([])).toEqual([]);
  });

  it("groups transactions on the same day under one label", () => {
    const date = new Date("2026-03-11T10:00:00Z");
    const result = groupByDate([tx("a", date), tx("b", date)]);
    expect(result).toHaveLength(1);
    expect(result[0]?.items).toHaveLength(2);
  });

  it('puts today\'s transaction under "Hoy"', () => {
    const now = new Date();
    const result = groupByDate([tx("a", now)]);
    expect(result[0]?.label).toBe("Hoy");
  });

  it('puts yesterdays\'s transaction under "Ayer"', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const result = groupByDate([tx("a", yesterday)]);
    expect(result[0]?.label).toBe("Ayer");
  });

  it("puts older transactions under a formatted date", () => {
    const old = new Date("2026-01-15T12:00:00Z");
    const result = groupByDate([tx("a", old)]);
    expect(result[0]?.label).toMatch(/enero/);
  });

  it("orders groups newest first", () => {
    const older = new Date("2026-03-10T10:00:00Z");
    const newer = new Date("2026-03-11T10:00:00Z");
    const result = groupByDate([tx("a", older), tx("b", newer)]);
    expect(
      new Date(String(result[0]?.items[0]?.transacted_at)) >
        new Date(String(result[1]?.items[0]?.transacted_at)),
    ).toBe(true);
  });
});
