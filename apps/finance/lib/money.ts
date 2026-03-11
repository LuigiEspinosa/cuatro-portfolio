import Decimal from "decimal.js";

// Configure once - nerver override per-operation
// 20 digits handles Colombiam peso amount up to $100 Trillion
//    with 6 decimal places of precision.
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_EVEN });

export const money = {
  // Covert centavos (stored in DB as BIGINT) to Decimal for arithmetic
  fromCentavos: (centavos: bigint): Decimal =>
    new Decimal(centavos.toString()).dividedBy(100),

  // Convert Decimal result back to centavos for DB storage
  // toFixed(0) applies the configured banker's rounding before BigInt conversion.
  toCentavos: (amount: Decimal): bigint => BigInt(amount.times(100).toFixed(0)),

  add: (a: bigint, b: bigint): bigint =>
    money.toCentavos(money.fromCentavos(a).plus(money.fromCentavos(b))),

  subtract: (a: bigint, b: bigint): bigint =>
    money.toCentavos(money.fromCentavos(a).minus(money.fromCentavos(b))),

  // Apply a multiplier (rate, factor) to a centavo amount
  multiply: (centavos: bigint, factor: Decimal): bigint =>
    money.toCentavos(money.fromCentavos(centavos).times(factor)),

  // Compute X% of an amount. pct is 0-100 (e.g. 28.5 for 28.5%)
  percentage: (centavos: bigint, pct: Decimal): bigint =>
    money.toCentavos(money.fromCentavos(centavos).times(pct).dividedBy(100)),

  // Convert foreign currency centavos to COP centavos using a locked rate
  convertToCOP: (foreignCentavos: bigint, rate: Decimal): bigint =>
    money.toCentavos(money.fromCentavos(foreignCentavos).times(rate)),

  // Colombian peso display format: $ 1.234.567
  formatCOP: (centavos: bigint): string =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(Number(money.fromCentavos(centavos))),

  formatUSD: (centavos: bigint): string =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(money.fromCentavos(centavos))),

  isPositive: (centavos: bigint): boolean => centavos > 0n,
  isZero: (centavos: bigint): boolean => centavos === 0n,

  max: (a: bigint, b: bigint): bigint => (a > b ? a : b),
  min: (a: bigint, b: bigint): bigint => (a < b ? a : b),

  sum: (amounts: bigint[]): bigint =>
    amounts.reduce((acc, val) => money.add(acc, val), 0n),
};
