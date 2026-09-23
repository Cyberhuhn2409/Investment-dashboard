# PROGRESS

Laufendes Fortschrittsprotokoll für „Signal“. Neueste Einträge oben.

## Status

| Bereich | Stand |
| --- | --- |
| Projekt-Setup (Next.js 16, TS strict, Tailwind 4, ESLint, Vitest, Playwright) | ✅ |
| Universe-Config (148 US + DAX 40), Domänenmodell, Scoring + Unit-Tests | ✅ |
| Provider-Schicht: deterministischer Mock, Finnhub, Twelve Data, Alpha Vantage, ApeWisdom, Reddit, Claude; SWR-Cache, Rate-Limits | ✅ |
| Design-System & App-Shell (Tab-Leiste, Seitenleiste, Large Titles, ⌘K-Suche, Dunkel/Hell, PWA) | ✅ |
| Screens: Start, Heatmap, Entdecken, Detail, Watchlist, Suche | ✅ |
| Zustände: Laden, Leer, Fehler, Veraltet, Nicht gefunden | ✅ |
| E2E (Playwright, mobil + Desktop) inkl. axe WCAG 2.2 AA in beiden Themes | ✅ 38 Tests |
| Unit-Tests (Vitest) | ✅ 105 Tests |
| Screenshots 390/1440 × Dunkel/Hell (15 Motive) | ✅ `/screenshots` |
| Lighthouse mobil (Performance ≥ 90, Accessibility ≥ 95) | ✅ Perf 95–98, A11y 100 |
| README, `.env.example`, DECISIONS | ✅ |

## Offene Punkte / Ideen

- Echte Provider konnten in der Build-Umgebung nicht live getestet werden (Proxy blockiert die Anbieter-Domains). Parser sind gegen dokumentierte Antwortformate mit Fixtures getestet; ein kurzer Smoke-Test mit echten Schlüsseln ist vor Produktivbetrieb sinnvoll.
- Handelskalender ohne Feiertage (Mock und Sitzungslogik).
- ApeWisdom-Basislinie braucht einige Tage eigener Historie, bis der Buzz-Faktor aussagekräftig ist.

## Log

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
