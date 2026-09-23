# Signal

**Marktsignale aus Kursen, Nachrichten und Social-Media-Diskussionen – transparent erklärt.**

Signal ist eine mobile-first Web-App (PWA) im Stil eines modernen Markt-Terminals. Sie verdichtet Kursdaten, News und Diskussionen (Reddit u. a.) für **531 Aktien** – US-Werte aller Größenklassen sowie DAX, MDAX und SDAX – zu nachvollziehbaren Signalen und zeigt standardmäßig nur, was **gerade relevant** ist. Kurse aktualisieren sich **live**. Jeder Score wird in Alltagssprache begründet und in seine Bestandteile zerlegt. Signal ist ein **Recherche-Werkzeug – keine Anlageberatung**, kein Handel, keine Konten.

| Start | Heatmap | Detail | Entdecken |
| --- | --- | --- | --- |
| ![Start](screenshots/01-start-390-dark.png) | ![Heatmap](screenshots/02-heatmap-390-dark.png) | ![Detail](screenshots/06-detail-390-dark.png) | ![Entdecken](screenshots/04-entdecken-390-light.png) |

Alle Screenshots (390 px und 1440 px, Dunkel und Hell, inkl. Lade-/Fehler-/Leer-/Veraltet-Zuständen) liegen in [`/screenshots`](screenshots).

## Funktionen

- **Start:** Börsenuhren und Live-Status, Laufband (Indizes + relevanteste Werte, live), Indexkarten, Top-Signale, **Segment-Radar** (relevante Werte, Marktbreite und Ø-Bewegung je Mega/Large/Mid/Small Cap und DAX/MDAX/SDAX), größte Bewegungen je Größenklasse, Trending auf Social.
- **Heatmap:** Sektor-Treemap (Kachelgröße = Marktkapitalisierung) je Größenklasse und Region, Einfärbung nach Kurs (1T live, 1W, 1M), Buzz oder Stimmung, „Relevante hervorheben“, Sektor-Zoom, Kachel → Detail.
- **Entdecken:** zuerst nur **relevante** Werte (Score ≥ 60 oder ungewöhnliche Tagesbewegung), „Alle“ per Klick; Schnellfilter Größenklasse und Index, dazu Sektor, Region, Signaltyp, Tendenz, Mindest-Score, Sortierung (alles in der URL teilbar). Auf breiten Bildschirmen dichte, sortierbare Tabelle mit Live-Kursen.
- **Detail:** Live-Kurs mit Tick-Aufleuchten, Kurschart 1T–5J (bei offener Börse startet „Heute“ und läuft live mit) mit Fadenkreuz-Scrubbing (Maus & Touch), Erwähnungen als Balken, Kennzahlen inkl. Größenklasse/Index, Score-Aufschlüsselung + „Warum markiert?“, Stimmung, Top-Diskussionen (mit Link), News, Hinweis „Keine Anlageberatung“.
- **Watchlist** (lokal im Browser, live) und **globale Suche** (⌘K / Strg+K, „/“, Such-Tab) über alle 531 Werte.
- Terminal-Anmutung mit moderner Bedienung: Bernstein-Akzent, Monospace-Zahlen, Haarlinien-Panels; Tab-Leiste mobil, Seitenleiste auf Desktop, Safe Areas, Spring-Animationen (Motion), Shared-Element-Übergang Karte → Detail (View Transitions), Skeletons, `prefers-reduced-motion`, Dunkel (Standard) + Hell, WCAG AA.

## Schnellstart

Voraussetzung: Node.js ≥ 20.9.

```bash
npm install
npm run dev          # http://localhost:3000 – läuft sofort mit Demo-Daten
```

Produktion:

```bash
npm run build
npm run start
```

Ohne `.env` läuft alles mit **deterministischen Demo-Daten** (klar als „Demo“ gekennzeichnet). Für echte Daten `.env.example` nach `.env.local` kopieren und Schlüssel eintragen – siehe [Datenquellen](#datenquellen-und-limits).

## Skripte

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver (Turbopack) |
| `npm run build` / `npm run start` | Produktions-Build / -Server |
| `npm run lint` | ESLint (0 Warnungen erlaubt) |
| `npm run typecheck` | Routen-Typen generieren + `tsc --noEmit` (strict) |
| `npm test` | Unit-Tests (Vitest): Scoring, Sentiment, Parser, Cache, Rate-Limits, Mock, Filter, Suche |
| `npm run e2e` | Playwright E2E (mobil + Desktop) inkl. axe-WCAG-Prüfung in beiden Themes – vorher `npm run build` |
| `npm run screenshots` | Screenshots aller Screens nach `/screenshots` – vorher `npm run build` (einzelne Motive: `SHOTS=05,16 npm run screenshots`) |
| `npm run lighthouse` | Lighthouse (mobil) für 5 Seiten; bricht ab bei Performance < 90 oder Accessibility < 95 |
| `npm run verify` | lint + typecheck + test + build |

Für reproduzierbare Tests/Screenshots den Build mit eingefrorener Zeit erzeugen:

```bash
MOCK_NOW=2026-09-23T18:30:00Z npm run build && npm run e2e && npm run screenshots && npm run lighthouse
```

Playwright nutzt Chromium; ein anderer Browser-Pfad lässt sich per `PLAYWRIGHT_CHROMIUM_PATH` bzw. `CHROME_PATH` (Lighthouse) setzen.

## Datenquellen und Limits

Alle Abrufe laufen serverseitig (Server Components, Route Handler). Schlüssel verlassen nie den Server. Jeder Anbieter hat einen eigenen Token-Bucket (inkl. Tageslimit und Pause nach HTTP 429), Antworten werden mit Stale-While-Revalidate gecacht. Fällt eine Quelle aus, zeigt Signal den letzten Stand mit „Stand: …“ und Hinweis „möglicherweise veraltet“.

| Anbieter | Aktivierung | Genutzt für | Gratis-Limit | Hinweise |
| --- | --- | --- | --- | --- |
| Finnhub | `FINNHUB_API_KEY` | Kurs, Kennzahlen, Unternehmensnews (US); **Echtzeit-Trades per WebSocket** (US + ETF-Proxys) | 60/Min., WebSocket 50 Symbole | Kerzen & Social Sentiment sind Premium → nicht genutzt; persönliche Nutzung |
| Twelve Data | `TWELVEDATA_API_KEY` | Tageshistorie, Intraday (5/30 Min.), Index-ETFs (SPY, QQQ, EXS1) | 8/Min., 800/Tag | XETRA nur im Bezahltarif (`TWELVEDATA_XETRA=true`); Attribution wird angezeigt |
| Alpha Vantage | `ALPHAVANTAGE_API_KEY` | XETRA-Tageskurse (100 Tage), optional News | 25/Tag, 5/Min. | reicht nicht für alle DAX-Werte → Cache 24 h |
| ApeWisdom | `APEWISDOM_ENABLED=true` | Reddit-/4chan-Erwähnungen (US) | nicht dokumentiert → max. alle 15 Min. | keine Texte/Stimmung; 30-Tage-Basislinie baut sich aus eigenen Tageswerten auf |
| Reddit | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` | Diskussionen, Erwähnungen, Stimmung (US + DE-Subreddits) | 100/Min. je Client | nur mit freigegebenen Zugangsdaten (Responsible Builder Policy) |
| Anthropic Claude | `ANTHROPIC_API_KEY` (optional `ANTHROPIC_MODEL`, Standard `claude-opus-5`) | Deutsche Zusammenfassung der Top-Diskussionen, Stimmung je Beitrag | nach Konto | Fallback auf Lexikon-Analyse bei Fehler/Ablehnung |
| Stocktwits | – | **nicht genutzt** | – | API-Registrierung geschlossen, Nutzungsbedingungen verbieten Verwertung; kein Scraping |

Details, Begründungen und Stand der Recherche: [`DECISIONS.md`](DECISIONS.md) (D5).

**Scan-Umfang:** Mit echten Schlüsseln wertet der Snapshot standardmäßig nur Mega/Large Caps und den DAX laufend aus (`SCAN_UNIVERSE=mega,large,DAX`), weil Gratis-Kontingente nicht für 531 Werte reichen. Alle anderen Werte sind über Suche, Detailseite und Watchlist trotzdem vollständig nutzbar. Mit Bezahltarifen z. B. `SCAN_UNIVERSE=all`.

**Mischbetrieb:** Sind nur einige Quellen konfiguriert, werden Lücken mit gekennzeichneten Demo-Daten gefüllt („Teils Demo“). `ALLOW_MOCK_FALLBACK=false` schaltet das ab. Fehlende Daten werden nie erfunden: Ohne Intraday-Quelle zeigt der 1T-Chart einen Hinweis.

## Echtzeit

Live-Kurse kommen per **Server-Sent Events** (`/api/live`): eine Verbindung pro Browser-Tab, nur geänderte Kurse, höchstens einmal pro Sekunde. Der Stream startet nach dem ersten Rendern, pausiert in Hintergrund-Tabs und verbindet sich nach Ausfällen selbst neu.

| Modus | Wann | Quelle |
| --- | --- | --- |
| **Live · simuliert** | ohne Schlüssel (Demo) | deterministische Simulation – identisch mit dem Server-Rendering, nur während der Handelszeiten |
| **Echtzeit** | `FINNHUB_API_KEY` gesetzt | Finnhub-Trade-WebSocket (US-Aktien, ETF-Proxys für S&P 500/Nasdaq 100), serverseitig gebündelt; Schlüssel bleibt auf dem Server |
| **Verzögert** | Werte ohne Echtzeitquelle (z. B. XETRA im Gratis-Tarif) | zuletzt geladener Kurs, ohne zusätzliche API-Aufrufe |

Optional: `FINNHUB_WS=false` schaltet das WebSocket-Relay ab, `FINNHUB_WS_SYMBOLS` begrenzt die Zahl gleichzeitig abonnierter Symbole (Standard 50). Hinweis zum Hosting: SSE braucht eine Umgebung, die Antworten streamt (z. B. `next start`, Node-Server; bei Proxys Pufferung abschalten).

## Relevanz

Standardansichten zeigen nur Werte, bei denen gerade etwas passiert: **Score ≥ 60** oder eine **Tagesbewegung ≥ 2,5 σ** (übliche Tagesschwankung der letzten 60 Tage). Schwellen in [`src/config/signals.ts`](src/config/signals.ts) (`RELEVANCE`). In der Demo sind das rund 100 von 531 Werten.

## Signal-Score

Score 0–100 = gewichtete Summe von sechs normierten Faktoren (Gewichte, Kappungen, Fenster in [`src/config/signals.ts`](src/config/signals.ts)):

| Faktor | Messung | Gewicht |
| --- | --- | --- |
| Erwähnungs-Spike | z-Score der Erwähnungen (24 Std.) ggü. 30-Tage-Basis, Streuung nach unten begrenzt | 30 % |
| Stimmungsniveau | durchschnittliche Stimmung heute (−1…+1) | 10 % |
| Stimmungswechsel | Stimmung heute vs. Vorwoche | 15 % |
| Kursmomentum | 20-Tage-Rendite relativ zur üblichen Schwankung (σ·√20) | 20 % |
| Volumen-Anomalie | Volumen vs. 20-Tage-Schnitt (laufende Sitzung hochgerechnet) | 15 % |
| Nachrichtenlage | Nachrichten in 48 Std. vs. übliches Aufkommen (Poisson-z) | 10 % |

Fehlen Daten, wird das Gewicht auf die übrigen Faktoren verteilt und im UI genannt. Der Signaltyp ist der ungewöhnlichste Faktor, die Tendenz ergibt sich aus Stimmung und Momentum. Ab 60 Punkten gilt ein Wert als „markiert“. Der Score beschreibt **Auffälligkeit, keine Kaufempfehlung**. Alle Faktoren sind unit-getestet (`src/lib/scoring/score.test.ts`).

## Universum

531 Werte in einer Datei: [`src/config/universe.ts`](src/config/universe.ts) (Symbol, Name, Sektor, Börse, grobe Marktkapitalisierung, Aliase für die Suche). Sortiert nach Region und Segment; die **Größenklasse** wird aus der Marktkapitalisierung (USD) abgeleitet:

| Klasse | Marktkapitalisierung | Werte (US / DE) |
| --- | --- | --- |
| Mega Caps | ab 200 Mrd. $ | 49 / 2 |
| Large Caps | 10–200 Mrd. $ | 206 / 47 |
| Mid Caps | 2–10 Mrd. $ | 100 / 44 |
| Small Caps | unter 2 Mrd. $ | 50 / 33 |

Deutsche Werte tragen zusätzlich ihren Index (DAX 40, MDAX 45, SDAX 41 – Zusammensetzung quartalsweise prüfen).

## Architektur

```
src/
  app/                 Routen (App Router): Start, /heatmap, /entdecken, /aktie/[symbol], /watchlist,
                       API: /api/live (SSE), /api/chart, /api/rows, /api/discover
  components/          UI (Shell, Live, Heatmap, Detail, Entdecken, Watchlist, Suche, UI-Primitives)
  config/              Universum (Größenklassen, Indizes), Sektoren, Signal-Gewichte, Relevanz
  lib/
    scoring/           Score-Berechnung (rein, getestet)
    sentiment/         Lexikon-Sentiment (EN/DE, Finanz-Slang)
    live/              Client-Store für Live-Kurse (EventSource, Referenzzählung)
    providers/         Interfaces, Mock-Provider + Live-Simulation, echte Provider, Finnhub-WebSocket, Parser
    server/            Cache (SWR), Rate-Limiter, HTTP, Provider-Registry, Markt- und Live-Service
e2e/                   Playwright: Ablauf, Zustände, Barrierefreiheit, Screenshots
```

Fortschritt: [`PROGRESS.md`](PROGRESS.md) · Entscheidungen: [`DECISIONS.md`](DECISIONS.md)

## Rechtliches

- **Keine Anlageberatung.** Inhalte dienen ausschließlich der Information und Recherche.
- Charts: [TradingView Lightweight Charts™](https://www.tradingview.com/) – Copyright © TradingView, Inc. (Apache-2.0, Attribution im Chart und in der App).
- Demo-Daten sind simuliert; Demo-Diskussionen und -Nachrichten sind als „Beispiel“ gekennzeichnet und verlinken auf echte Suchseiten statt auf erfundene Artikel.
