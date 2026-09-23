import "server-only";

/**
 * Referenz-„Jetzt“ für Daten und Signale. `MOCK_NOW` (ISO-Zeitpunkt) friert die
 * Zeit ein – nützlich für reproduzierbare Screenshots und E2E-Tests.
 */
export function nowMs(): number {
  const fixed = process.env.MOCK_NOW;
  if (fixed) {
    const t = Date.parse(fixed);
    if (Number.isFinite(t)) return t;
  }
  return Date.now();
}

export type MockScenario = "normal" | "stale" | "error";

/** Demo-Szenario für die Gestaltung von Zuständen (nur Mock-Daten). */
export function mockScenario(): MockScenario {
  const s = process.env.MOCK_SCENARIO;
  return s === "stale" || s === "error" ? s : "normal";
}

/** Versatz der Referenzzeit zur echten Zeit (nur bei MOCK_NOW ≠ 0) – für Uhren im Client. */
export function clockOffsetMs(): number {
  return process.env.MOCK_NOW ? nowMs() - Date.now() : 0;
}
