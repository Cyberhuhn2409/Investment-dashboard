# PROGRESS

Laufendes Fortschrittsprotokoll für „Signal“. Neueste Einträge oben.

## Status

| Bereich | Stand |
| --- | --- |
| Projekt-Setup (Next.js 16, TS strict, Tailwind 4, ESLint, Vitest, Playwright) | ✅ |
| Universum: 531 Werte (US Mega/Large/Mid/Small, DAX/MDAX/SDAX) mit Größenklassen | ✅ |
| Relevanz-Filter (Score ≥ 60 oder Tagesbewegung ≥ 2,5 σ), Segment-Radar, Größen-/Indexfilter | ✅ |
| Live-Kurse: SSE-Stream, Demo-Simulation, Finnhub-WebSocket-Relay, Client-Store | ✅ |
| Terminal-Design (Bernstein-Akzent, Monospace-Zahlen, Laufband, Börsenuhren, Tick-Aufleuchten) | ✅ |
| Provider-Schicht: deterministischer Mock, Finnhub, Twelve Data, Alpha Vantage, ApeWisdom, Reddit, Claude; SWR-Cache, Rate-Limits, Scan-Umfang | ✅ |
| Screens: Start, Heatmap, Entdecken, Detail, Watchlist, Suche | ✅ |
| Zustände: Laden, Leer, Fehler, Veraltet, Nicht gefunden (+ „nichts Auffälliges“, Segment ohne Daten) | ✅ |
| E2E (Playwright, mobil + Desktop) inkl. Live-Ticks und axe WCAG 2.2 AA in beiden Themes | ✅ 40 Tests |
| Unit-Tests (Vitest) | ✅ 129 Tests |
| Echtdaten-Modus gegen nachgebildete Anbieter (`npm run test:realmode`) | ✅ 21 Prüfungen |
| Screenshots 390/1440 × Dunkel/Hell (17 Motive) | ✅ `/screenshots` |
| Lighthouse mobil (Performance ≥ 90, Accessibility ≥ 95) | ✅ Perf 93–96, A11y 100 |
| README, `.env.example`, DECISIONS (D9–D12 neu) | ✅ |

## Offene Punkte / Ideen

- Finnhub-WebSocket-Relay ist gegen nachgebildete Anbieter Ende-zu-Ende getestet (`npm run test:realmode`), aber nicht gegen den echten Dienst (Proxy blockiert Anbieter). Vor Produktivbetrieb kurz mit echtem Schlüssel prüfen.
- SSE setzt eine streamende Hosting-Umgebung voraus (Node-Server); bei Serverless-Plattformen begrenzen Laufzeitlimits die Stream-Dauer (EventSource verbindet neu).
- Indexzugehörigkeit MDAX/SDAX und Marktkapitalisierungen sind Näherungen – quartalsweise prüfen.

- Echte Provider konnten in der Build-Umgebung nicht live getestet werden (Proxy blockiert die Anbieter-Domains). Parser sind gegen dokumentierte Antwortformate mit Fixtures getestet; ein kurzer Smoke-Test mit echten Schlüsseln ist vor Produktivbetrieb sinnvoll.
- Handelskalender ohne Feiertage (Mock und Sitzungslogik).
- ApeWisdom-Basislinie braucht einige Tage eigener Historie, bis der Buzz-Faktor aussagekräftig ist.

## Log

- **Komplett-Test des Echtdaten-Modus (09/2026):** nachgebildete Anbieter (Finnhub REST + WebSocket, Twelve Data), `npm run test:realmode` mit 21 Prüfungen im Browser; Unit-Tests für das WebSocket-Relay (Abos, Referenzzählung, Top-N, Backoff, Leerlauf). Behoben: „Echtzeit“ trotz getrennter Verbindung; erster Seitenaufruf mit Gratis-Limits dauerte ~2 Min. 45 Sek. → jetzt ~8 s, Rest lädt im Hintergrund (D13).

- **Erweiterung „breit, relevant, live, Terminal-Look“ (09/2026):**
  - Universum auf 531 Werte erweitert (US Mid/Small Caps, weitere Large Caps, MDAX, SDAX); Größenklasse aus Marktkapitalisierung, Index für XETRA-Werte; Mock nach Größenklasse kalibriert. `SCAN_UNIVERSE` für echte Provider (Standard Mega/Large + DAX), nicht gescannte Werte per `getRows` nachladbar.
  - Relevanz (markiert oder Tagesbewegung ≥ 2,5 σ) als Standardansicht in Entdecken; Größen-/Index-Schnellfilter; Gesamtliste wird erst bei „Alle“ geladen (`/api/discover`), damit das HTML klein bleibt.
  - Live-Schicht: `/api/live` (SSE), Demo-Kurs als reine Funktion der Zeit (SSR = Stream), Finnhub-WebSocket-Relay mit Referenzzählung, Client-Store (eine Verbindung, Pause im Hintergrund). Live-Kurse in Karten, Listen, Laufband, Heatmap (1T) und Detail (Chart per `series.update`).
  - Terminal-Design: Bernstein-Akzent, Monospace-Tabellenziffern, Haarlinien-Panels, Statusleiste mit Börsenuhren, Laufband, Segment-Radar, Tabellen per Container Queries.
  - Verifikation: lint, typecheck, 124 Unit-Tests, 40 E2E-Tests (inkl. Live-Ticks, axe beide Themes), Lighthouse mobil 93–96 / A11y 100, 68 Screenshots neu erzeugt und gesichtet. Dabei behoben: Layout-Shift durch Live-Status, Dauer-Repaints durch Box-Shadow-Puls, zu großes HTML in Entdecken, Theme auf 404-Seiten, veralteter „XYZ“-Testticker (inzwischen Block Inc.).

- **Verifikation:** build, lint, typecheck, 105 Unit-Tests, 38 E2E-Tests grün; Lighthouse mobil alle fünf Seiten ≥ 95 Performance / 100 Accessibility; 60 Screenshots geprüft und Auffälligkeiten behoben (doppelte Demo-Beiträge, abgeschnittene Heatmap-Ticker, Breadcrumb-Umbruch, Layout-Shift im Chart).
- **Zustände & Screenshots:** Lade-/Fehler-/Veraltet-Zustände per Request-Interception fotografiert; Screenshot-Suite in `e2e/screenshots.spec.ts`.
- **Performance:** Suspense-Grenzen auf statischen Routen entfernt (LCP von ~1,7 s auf ~0,15 s im Browser), Link-Pending-Zustand, Chart-Skeleton als Overlay (CLS 0).
- **Barrierefreiheit:** axe-Prüfung beider Themes, Target-Size in der Heatmap, fokussierbarer Scrollbereich, Chart ohne verschachtelte interaktive Rolle.
- **E2E:** Ablauf Start → Heatmap → Kachel → Detail → Watchlist → Suche, Filter, Zustände, API-Validierung; echte 404 für unbekannte Symbole.
- **Echte Provider:** Finnhub, Twelve Data, Alpha Vantage, ApeWisdom (opt-in), Reddit (OAuth), Claude (SDK, Structured Output, Fallbacks) inkl. Parser- und Auswahl-Tests; Stocktwits bewusst nicht (Registrierung geschlossen, ToS).
- **Screens:** Start, Heatmap (d3-hierarchy, Zoom), Entdecken (Filter, URL-Sync, Sheet), Detail (Lightweight Charts mit Scrubbing, Erwähnungs-Overlay, Score-Aufschlüsselung, Diskussionen, News, Kennzahlen), Watchlist (lokal, Bearbeiten), Suche (⌘K).
- **Design-System & Shell:** Tokens (Dunkel Standard, Hell), Systemschrift, tabular-nums, Tab-Leiste/Seitenleiste, iOS-Large-Title, Motion (LazyMotion), View Transitions für Shared Elements, PWA-Manifest + Service Worker.
- **Datenschicht:** Provider-Interfaces, deterministischer Mock mit Markt-/Sektorfaktoren und kuratierten Storys, SWR-Cache mit Dedupe, Token-Bucket-Limiter, Markt-Service (Snapshot, Detail, Charts).
- **Scoring:** 6 Faktoren, Gewichte in Config, Umverteilung bei fehlenden Daten, Typ = ungewöhnlichster Faktor, Erklärtexte + Kurzbegründungen; Lexikon-Sentiment (EN/DE).
- **Setup:** Next.js 16.3 App Router per `create-next-app` erzeugt, TypeScript auf 5.9 fixiert (typescript-eslint unterstützt TS 7 noch nicht), Skripte für lint/typecheck/test/e2e/screenshots/lighthouse angelegt.
