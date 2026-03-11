import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { money } from "../money";

describe("money.fromCentavos", () => {
  it("converts zero", () => {
    expect(money.fromCentavos(0n).toString()).toBe("0");
  });

  it("converts a positive amount", () => {
    expect(money.fromCentavos(10050n).toString()).toBe("100.5");
  });

  it("converts a negative amount (debit)", () => {
    expect(money.fromCentavos(-50000n).toString()).toBe("-500");
  });

  it("handles large Colombian amounts ($50M COP = 5_000_000_000 centavos", () => {
    expect(money.fromCentavos(5_000_000_000n).toString()).toBe("50000000");
  });
});

describe("money.toCentavos", () => {
  it("converts a whole amount", () => {
    expect(money.toCentavos(new Decimal("100"))).toBe(10000n);
  });

  it("converts an amount with cents", () => {
    expect(money.toCentavos(new Decimal("100.5"))).toBe(10050n);
  });

  it("rounds using banker's rounding (0.5 rounds to even)", () => {
    // 0.005 -> 0.5 centavos -> rounds to 0 (even)
    expect(money.toCentavos(new Decimal("0.005"))).toBe(0n);
    // 0.015 -> 1.5 centavos -> rounds to 2 (even)
    expect(money.toCentavos(new Decimal("0.015"))).toBe(2n);
  });

  it("round-trips with fromCentavos", () => {
    const original = 123456789n;
    expect(money.toCentavos(money.fromCentavos(original))).toBe(original);
  });
});

describe("money.add", () => {
  it("adds two positive amounts without float drift", () => {
    // $100.10 + $200.20 = $300.30, not $300.29999...
    expect(money.add(10010n, 20020n)).toBe(30030n);
  });

  it("adds a positive and negative (net balance)", () => {
    expect(money.add(50000n, -20000n)).toBe(30000n);
  });

  it("adds two negatives", () => {
    expect(money.add(-10000n, -5000n)).toBe(-15000n);
  });

  it("adds zero", () => {
    expect(money.add(10000n, 0n)).toBe(10000n);
  });
});

describe("money.subtract", () => {
  it("subtracts basic amount", () => {
    expect(money.subtract(50000n, 20000n)).toBe(30000n);
  });

  it("result can go negative (payment exceeds balance)", () => {
    expect(money.subtract(10000n, 50000n)).toBe(-40000n);
  });

  it("subtract zero", () => {
    expect(money.subtract(10000n, 0n)).toBe(10000n);
  });
});

describe("money.multiply", () => {
  it("applies an interest rate factor", () => {
    // $1,000 * 0.285 monthly = $285
    expect(money.multiply(100000n, new Decimal("0.285"))).toBe(28500n);
  });

  it("handles fractional results with correct rounding", () => {
    // $1 * 1/3 = $0.33 (rounds down)
    const result = money.multiply(100n, new Decimal("1").dividedBy(3));
    expect(result).toBe(33n);
  });

  it("multiples by 1 returns same amount", () => {
    expect(money.multiply(50000n, new Decimal("1"))).toBe(50000n);
  });

  it("multiplies by 0 returns zero", () => {
    expect(money.multiply(50000n, new Decimal("0"))).toBe(0n);
  });
});

describe("money.percentage", () => {
  it("calculates 80% alert threshold", () => {
    // 80% of $1,000,000 COP = $800,000
    expect(money.percentage(100000000n, new Decimal("80"))).toBe(80000000n);
  });

  it("calculates 28.5% APR on a balance", () => {
    // 28.5% of $3,000,000 = $855,000
    expect(money.percentage(300000000n, new Decimal("28.5"))).toBe(85500000n);
  });

  it("0% returns zero", () => {
    expect(money.percentage(100000n, new Decimal("0"))).toBe(0n);
  });

  it("100% returns the full amount", () => {
    expect(money.percentage(100000n, new Decimal("100"))).toBe(100000n);
  });
});

describe("money.convertToCOP", () => {
  it("converts USD to COP at a known rate", () => {
    // $100 USD at 4,200 COP/USD = $420,00 COP
    // 10000 centavos (USD) * 4200 = 42,000,000 COP centavos
    expect(money.convertToCOP(10000n, new Decimal("4200"))).toBe(42_000_000n);
  });

  it("converts at a fractional rate", () => {
    // $1 USD at 4,150.75 COP/USD
    expect(money.convertToCOP(100n, new Decimal("4150.75"))).toBe(415075n);
  });
});

describe("money.formatCOP", () => {
  it("formats a standard COP amount", () => {
    // $1,234,567
    const result = money.formatCOP(123456700n);
    expect(result).toContain("1");
    expect(result).toContain("234");
    expect(result).toContain("567");
  });

  it("formats zero", () => {
    const result = money.formatCOP(0n);
    expect(result).toContain("0");
  });

  it("formats negative amounts", () => {
    const result = money.formatCOP(-100000n);
    expect(result).toContain("-");
  });
});

describe("money.formatUSD", () => {
  it("formats with cents", () => {
    // $1,234.57
    const result = money.formatUSD(123457n);
    expect(result).toContain("1,234");
    expect(result).toContain("57");
    expect(result).toContain("$");
  });
});

describe("money.sum", () => {
  it("sums an array of amounts", () => {
    expect(money.sum([10000n, 20000n, 30000n])).toBe(60000n);
  });

  it("returns 0n for an empty array", () => {
    expect(money.sum([])).toBe(0n);
  });

  it("handles mixed positive and negative", () => {
    expect(money.sum([50000n, -20000n, 10000n])).toBe(40000n);
  });
});

describe("money.isPositive", () => {
  it("returns true for positive amounts", () => {
    expect(money.isPositive(1n)).toBe(true);
  });

  it("returns false for zero", () => {
    expect(money.isPositive(0n)).toBe(false);
  });

  it("returns false for negative amounts", () => {
    expect(money.isPositive(-1n)).toBe(false);
  });
});

describe("money.isZero", () => {
  it("returns true for zero", () => {
    expect(money.isZero(0n)).toBe(true);
  });

  it("returns false for positive", () => {
    expect(money.isZero(1n)).toBe(false);
  });

  it("returns false for negative", () => {
    expect(money.isZero(-1n)).toBe(false);
  });
});

describe("money.max", () => {
  it("returns the larger value", () => {
    expect(money.max(50000n, 30000n)).toBe(50000n);
  });

  it("returns the value when equal", () => {
    expect(money.max(10000n, 10000n)).toBe(10000n);
  });

  it("handles negatives", () => {
    expect(money.max(-5000n, -1000n)).toBe(-1000n);
  });
});

describe("money.min", () => {
  it("returns the smaller value", () => {
    expect(money.min(30000n, 50000n)).toBe(30000n);
  });

  it("returns the value when equal", () => {
    expect(money.min(10000n, 10000n)).toBe(10000n);
  });

  it("handles negatives", () => {
    expect(money.min(-5000n, -1000n)).toBe(-5000n);
  });
});
