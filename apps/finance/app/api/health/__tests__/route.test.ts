import { describe, it, expect, vi } from "vitest";

const queryRaw = vi.fn();
vi.mock("@/lib/db", () => ({ db: { $queryRaw: queryRaw } }));

const { GET } = await import("../route");

describe("GET /api/health", () => {
  it("answers 200 when the database answers", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("answers 503 when the database does not, so the probe fails", async () => {
    queryRaw.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));
    const response = await GET();
    expect(response.status).toBe(503);
  });
});
