import { describe, expect, it } from "vitest";
import {
  formatCompact,
  formatDateTime,
  formatMarketCap,
  formatNumber,
  formatPercent,
  formatPrice,
  formatRelative,
  formatStand,
} from "./format";

describe("format", () => {
  it("formatiert Zahlen deutsch mit echtem Minus", () => {
    expect(formatNumber(1234.5)).toBe("1.234,50");
    expect(formatNumber(-3.14159, 1)).toBe("−3,1");
    expect(formatNumber(2, 1, { sign: true })).toBe("+2,0");
    expect(formatNumber(-0.001, 2, { sign: true })).toBe("0,00");
    expect(formatNumber(NaN)).toBe("–");
  });

  it("formatiert Prozent und Preise", () => {
    expect(formatPercent(1.234)).toBe("+1,23 %");
    expect(formatPercent(-0.5, 1)).toBe("−0,5 %");
    expect(formatPrice(189.5, "USD")).toBe("189,50 $");
    expect(formatPrice(23456.7, "EUR")).toBe("23.457 €");
  });

  it("formatiert große Zahlen kompakt", () => {
    expect(formatCompact(1_500)).toBe("1,5 Tsd.");
    expect(formatCompact(2_300_000)).toBe("2,3 Mio.");
    expect(formatMarketCap(3400, "USD")).toBe("3,4 Bio. $");
    expect(formatMarketCap(45, "EUR")).toBe("45,0 Mrd. €");
  });

  it("formatiert Zeiten in Europe/Berlin", () => {
    expect(formatDateTime("2026-09-23T14:05:00Z")).toBe("23.09.2026, 16:05");
    expect(formatStand("2026-01-10T08:00:00Z")).toBe("Stand: 10.01., 09:00");
  });

  it("relative Zeiten sind deterministisch zum Referenzpunkt", () => {
    const ref = "2026-09-23T12:00:00Z";
    expect(formatRelative("2026-09-23T11:59:40Z", ref)).toBe("gerade eben");
    expect(formatRelative("2026-09-23T11:30:00Z", ref)).toBe("vor 30 Min.");
    expect(formatRelative("2026-09-23T07:00:00Z", ref)).toBe("vor 5 Std.");
    expect(formatRelative("2026-09-22T10:00:00Z", ref)).toBe("gestern");
    expect(formatRelative("2026-09-19T10:00:00Z", ref)).toBe("vor 4 Tagen");
  });
});
