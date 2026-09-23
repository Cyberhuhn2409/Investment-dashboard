# DECISIONS

Architektur- und Produktentscheidungen für „Signal“. Jede Entscheidung mit Kontext und Begründung.

## D1 – Stack: Next.js 16 App Router, React 19.2, Tailwind 4, TypeScript 5.9 strict
- `create-next-app@16.3.6` als Basis. Turbopack ist in Next 16 Standard für dev und build.
- TypeScript bleibt auf 5.9.x: `typescript-eslint` (über `eslint-config-next`) unterstützt aktuell nur `<6.1`. TS 7 (Go-Port) würde Lint brechen.
- ESLint 9 statt 10, weil die React-/Import-Plugins von `eslint-config-next` auf 9 getestet sind.
- `@types/node@22`, weil Vitest 5 `^22 || >=24` als optionalen Peer verlangt.

## D2 – Playwright 1.56.1
Die Umgebung bringt Chromium r1194 unter `/opt/pw-browsers` mit; das passt exakt zu Playwright 1.56.1. Ein neueres Playwright würde einen Browser-Download verlangen. `PLAYWRIGHT_CHROMIUM_PATH` kann einen anderen Chromium setzen.
