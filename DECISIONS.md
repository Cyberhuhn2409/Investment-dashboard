# DECISIONS

Architektur- und Produktentscheidungen für „Signal“. Jede Entscheidung mit Kontext und Begründung.

## D1 – Stack: Next.js 16 App Router, React 19.2, Tailwind 4, TypeScript 5.9 strict
- `create-next-app@16.3.6` als Basis. Turbopack ist in Next 16 Standard für dev und build.
- TypeScript bleibt auf 5.9.x: `typescript-eslint` (über `eslint-config-next`) unterstützt aktuell nur `<6.1`. TS 7 (Go-Port) würde Lint brechen.
- ESLint 9 statt 10, weil die React-/Import-Plugins von `eslint-config-next` auf 9 getestet sind.
- `@types/node@22`, weil Vitest 5 `^22 || >=24` als optionalen Peer verlangt.

## D2 – Playwright 1.56.1
Die Umgebung bringt Chromium r1194 unter `/opt/pw-browsers` mit; das passt exakt zu Playwright 1.56.1. Ein neueres Playwright würde einen Browser-Download verlangen. `PLAYWRIGHT_CHROMIUM_PATH` kann einen anderen Chromium setzen.

## D3 – Architektur: Server-seitige Datenschicht mit Provider-Interfaces
- `PriceProvider`, `NewsProvider`, `SocialProvider`, `IndexProvider`, `TextAnalyzer` (`src/lib/providers/types.ts`).
- Alle Abrufe laufen serverseitig (Server Components, Route Handler `/api/chart/[symbol]`, `/api/rows`). Schlüssel werden nur in `src/lib/server/real-providers.ts` gelesen, kein `NEXT_PUBLIC_`-Präfix → nie im Client-Bundle.
- Eigener prozessweiter Cache mit Stale-While-Revalidate + In-Flight-Dedupe (`src/lib/server/cache.ts`). Schlägt eine Erneuerung fehl, wird der letzte Stand ausgeliefert und als „veraltet“ markiert (UI: Stand-Zeile + gelber Hinweis).
- Token-Bucket je Anbieter inkl. Tageskontingent und Cooldown nach HTTP 429 bzw. anbieterspezifischen Limit-Antworten (Alpha Vantage antwortet mit HTTP 200 + `Information`, Twelve Data mit `status:error, code:429`).
- Seiten sind statisch vorgerendert mit ISR (`revalidate = 60`). Detailseiten werden im Demo-Modus alle vorab gebaut; mit echten Providern erst bei Bedarf (schont Rate-Limits).
- Next.js „Cache Components“ bewusst nicht aktiviert: Das bisherige Modell (ISR + eigener Cache) ist für diese Datenlage einfacher nachvollziehbar.

## D4 – Deterministischer Mock-Provider als Standard
- Ohne Schlüssel läuft alles auf Demo-Daten (`src/lib/providers/mock`). Werte hängen nur vom Symbol und Handelskalender ab (seeded PRNG, mulberry32/cyrb53) → reproduzierbar für Tests und Screenshots. `MOCK_NOW` friert die Zeit ein.
- Kurse: GBM mit Markt- und Sektorfaktor (realistische Korrelationen in der Heatmap). Ein Teil der Werte bekommt eine „Story“ (Buzz-Ausbruch, Momentum, Stimmungswechsel, Nachrichtenwelle, Volumen) – einige sind kuratiert (z. B. NVDA, RHM.DE), damit die Demo aussagekräftige Beispiele zeigt.
- Demo-Inhalte sind überall gekennzeichnet („Demo“-Badge, „Beispiel“ an Diskussionen/News). Demo-Nachrichten nennen keine realen Medien als Quelle (nur Kategorien wie „Marktbericht“); Links führen auf echte Suchseiten (Google News, Reddit-Suche), nicht auf erfundene Artikel.
- `MOCK_SCENARIO=stale|error` erzeugt die Zustände „veraltet“ und „Fehler“ für Gestaltung und Tests.

## D5 – Anbieterwahl (Stand 09/2026, geprüft über offizielle Doku/Preis-/Nutzungsseiten)
Live-Abrufe waren aus der Build-Umgebung nicht möglich (Proxy blockiert die Anbieter-Domains); Parser sind gegen die dokumentierten Antwortformate mit Fixtures getestet.

| Anbieter | Nutzung in Signal | Gratis-Limits | Einschränkungen |
| --- | --- | --- | --- |
| **Finnhub** | Echtzeit-Kurs (`/quote`), Kennzahlen (`/stock/metric`, `/stock/profile2`), Unternehmensnews (`/company-news`) – nur US | 60 Aufrufe/Min. (+30/s) | Kerzen (`/stock/candle`) und `/stock/social-sentiment` sind Premium (403) → nicht genutzt. Internationale Börsen kostenpflichtig. Nutzung für persönliche, nicht-kommerzielle Zwecke. |
| **Twelve Data** | Tageshistorie (bis 5 Jahre), 5-/30-Min.-Kerzen, ETF-Proxys für Indizes | 8 Credits/Min., 800/Tag | XETRA erst ab Bezahltarif (`TWELVEDATA_XETRA=true` schaltet es frei). Attribution („Kursdaten: Twelve Data“ mit Link) wird angezeigt. Persönliche Nutzung. |
| **Alpha Vantage** | XETRA-Tageskurse (`.DEX`, 100 Tage), optional News mit Sentiment | 25 Anfragen/Tag, 5/Min. | Für 40 DAX-Werte zu knapp → nur ergänzend, 24 h Cache. Kommerzielle Nutzung nur nach Absprache. |
| **ApeWisdom** | Reddit-/4chan-Erwähnungen je US-Ticker (aktuell + vor 24 Std.) | nicht dokumentiert → max. alle 15 Min. | Keine Texte/Stimmung. Opt-in (`APEWISDOM_ENABLED=true`), da externer Aufruf ohne Vertrag. Die 30-Tage-Basislinie wird aus eigenen Tageswerten aufgebaut (`.data/mentions.json`); bis genügend Historie existiert, ist die Buzz-Komponente „ohne Daten“ und ihr Gewicht wird umverteilt. |
| **Stocktwits** | **nicht genutzt** | – | Neue API-Registrierungen geschlossen; die Nutzungsbedingungen untersagen Verwertung ohne ausdrückliche Erlaubnis. Kein Scraping. |
| **Reddit** | Diskussionen, Erwähnungen und Stimmung je Wert (Suche in ausgewählten Subreddits) | 100 Anfragen/Min. je OAuth-Client | Nur mit eigenen, freigegebenen Zugangsdaten (Responsible Builder Policy). Ohne Credentials kein Zugriff. User-Agent nach Reddit-Vorgabe erforderlich. |
| **Anthropic (Claude)** | Deutsche Zusammenfassung der Top-Diskussionen + Stimmung je Beitrag | nach Konto | Offizielles SDK `@anthropic-ai/sdk`, Modell `claude-opus-5` (per `ANTHROPIC_MODEL` änderbar), Structured Output (JSON Schema), serverseitige Fallbacks (`fallbacks: "default"`). Massenbewertung bleibt beim Lexikon (Kosten). Bei Ablehnung/Fehler automatisch Lexikon-Fallback. |

- **Mischbetrieb:** Sind nur einige Quellen konfiguriert, fallen fehlende Bereiche auf Demo-Daten zurück und werden als „Teils Demo“ gekennzeichnet. `ALLOW_MOCK_FALLBACK=false` schaltet das ab (dann fehlen die Daten ehrlich).
- **Keine erfundenen Werte:** Fehlt z. B. Intraday im Gratis-Tarif, zeigt der Chart einen Hinweis statt synthetischer Daten. Indizes laufen mit echten Anbietern über ETF-Proxys (SPY, QQQ, EXS1) und sind entsprechend beschriftet.

## D6 – Signal-Score
- Sechs Komponenten (Erwähnungs-Spike, Stimmungsniveau, Stimmungswechsel, Kursmomentum, Volumen-Anomalie, Nachrichtenlage), je 0–100 normiert, gewichtet (Gewichte in `src/config/signals.ts`, Summe 1).
- Erwähnungen: z-Score ggü. 30-Tage-Basis; Streuung nach unten begrenzt durch √μ (Poisson) **und** 25 % des Mittelwerts (Social-Zählungen sind überdispers – ohne diese Grenze würde jede Kleinigkeit in ruhigen Phasen zum Extremwert). Dünne Datenbasis (Ø < 5/Tag) deckelt die Komponente bei 60.
- Momentum als Rendite relativ zur erwarteten Schwankung (σ·√20), Volumen als Vielfaches des 20-Tage-Schnitts, News als Poisson-z-Score über 48 Std.
- Fehlt eine Komponente, wird ihr Gewicht proportional umverteilt (sonst würden Werte ohne Social-Daten systematisch schlechter abschneiden); das wird im UI genannt.
- Signaltyp = ungewöhnlichster Faktor (höchster Teilscore), nicht der mit dem größten Gewicht – sonst wäre fast alles „Buzz“. Richtung aus Stimmung, Stimmungswechsel und Momentum.
- Score beschreibt **Auffälligkeit**, keine Kaufempfehlung. Schwelle „markiert“ = 60.

## D7 – UI/UX
- Mobile: native Tab-Leiste (Start, Heatmap, Entdecken, Watchlist, Suche), iOS-Large-Title, der beim Scrollen in eine Glass-Leiste übergeht; Safe Areas über `env(safe-area-inset-*)` und `viewport-fit=cover`. Desktop: Seitenleiste + ⌘K.
- Systemschriften, `tabular-nums` für alle Zahlen, Dunkel als Standard (Theme-Skript im `<head>` verhindert Aufblitzen), Hell umschaltbar.
- Motion (`motion/react`) mit `LazyMotion` + asynchron geladenen Features (kleines Initial-Bundle): Segmented Controls, Tab-Tap, Bottom-Sheet mit Drag-to-dismiss, Heatmap-Zoom, animierte Listen, AnimatedNumber.
- Shared-Element Karte → Detail über React `<ViewTransition>` (in Next 16 integriert) statt Motion-`layoutId`, weil `layoutId` nicht über Routenwechsel funktioniert. Namen nur dort, wo ein Symbol genau einmal auf der Seite vorkommt.
- `prefers-reduced-motion`: Motion `reducedMotion="user"`, CSS-Animationen und View Transitions werden deaktiviert.
- Grün/Rot nie allein: Pfeile/Vorzeichen (▲▼), Screenreader-Texte („gestiegen um …“), Heatmap-Kacheln mit Wert als Text. Alle Heatmap-Farbstufen haben mit weißer Schrift ≥ 4,5:1 Kontrast (Unit-Test).
- Keine Firmenlogos (Markenrechte, externe Requests) → Monogramme mit Sektorfarbe.
- Charts: TradingView Lightweight Charts™ (Attribution-Logo im Chart + Link im Footer/Sidebar). Scrubbing per Maus und per Touch (eigener Pointer-Handler mit `touch-action: pan-y`, damit vertikales Scrollen erhalten bleibt).
- Heatmap: `d3-hierarchy` (Squarify) + absolut positionierte Links statt Canvas/ECharts – klein, zugänglich (jede Kachel ist ein fokussierbarer Link mit Label), animierbar.

## D8 – Performance & Zustände
- **Keine `loading.tsx` auf statischen Routen:** Ein Suspense-Boundary führt auch bei vorgerenderten Seiten dazu, dass React den Inhalt erst per (gedrosseltem) Suspense-Reveal einblendet – gemessen ~600 ms spätere LCP. Start, Heatmap, Entdecken, Watchlist und Detail sind vorgerendert; statt Routen-Skeletons zeigt der angetippte Link per `useLinkStatus` einen dezenten Pending-Zustand (relevant, wenn Detailseiten mit echten Providern erst bei Bedarf gerendert werden).
- **Echte 404:** Das Detail-Layout prüft das Symbol vor jedem Streaming (`notFound()` im Layout), daher antworten unbekannte Symbole mit HTTP 404.
- **Skeletons** bleiben dort, wo Daten clientseitig nachgeladen werden: Watchlist, Chart (Overlay, kein Layout-Shift), Chart-Zeitraumwechsel, Suche.
- **Volumen während der Sitzung** wird für den Vergleich linear auf einen ganzen Handelstag hochgerechnet (sonst wäre die Volumen-Anomalie vor Handelsschluss systematisch zu niedrig).
- **Heatmap:** Kacheln unter 24 px sind keine eigenen Link-Ziele (WCAG 2.5.8 Target Size); Tippen vergrößert den Sektor, dort werden sie zu Links. Sektor-Buttons sind 24 px hoch.
- **Monogramme, Systemschrift, keine externen Bilder/Fonts** halten das initiale Laden klein (Lighthouse mobil: Performance 95–98, Accessibility 100).
