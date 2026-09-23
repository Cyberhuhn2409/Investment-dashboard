// Integrationstest des Echtdaten-Modus gegen nachgebildete Anbieter (keine Schlüssel,
// kein Internet): Finnhub REST + WebSocket-Relay, Twelve Data, Mischbetrieb mit Demo-Fallback.
// Aufruf: node scripts/realmode-check.mjs   (startet Fake-Anbieter + `next dev`)
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { startFakeProviders } from "./fake-providers.mjs";

const FAKE = Number(process.env.FAKE_PORT ?? 4010);
const APP = Number(process.env.APP_PORT ?? 3400);
const BASE = `http://127.0.0.1:${APP}`;
const OUT = process.env.OUT_DIR ?? "test-results/realmode";
mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` – ${detail}` : ""}`);
}

async function waitFor(url, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return Date.now() - start;
    } catch {
      // startet noch
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} nicht erreichbar`);
}

const fake = await startFakeProviders(FAKE);
const env = {
  ...process.env,
  MOCK_NOW: "",
  FINNHUB_API_KEY: "test-key",
  FINNHUB_BASE_URL: `http://127.0.0.1:${FAKE}/finnhub`,
  FINNHUB_WS_URL: `ws://127.0.0.1:${FAKE}/ws`,
  TWELVEDATA_API_KEY: "test-key",
  TWELVEDATA_BASE_URL: `http://127.0.0.1:${FAKE}/twelve`,
  // Nachgebildete Anbieter haben keine Limits – der Test prüft die Datenwege, nicht die Kontingente
  FINNHUB_RPM: "100000",
  TWELVEDATA_RPM: "100000",
  TWELVEDATA_RPD: "1000000",
  SCAN_UNIVERSE: process.env.SCAN_UNIVERSE ?? "mega",
};
delete env.MOCK_NOW;
const nextBin = existsSync("node_modules/next/dist/bin/next") ? "node_modules/next/dist/bin/next" : "next";
const app = spawn(process.execPath, [nextBin, "dev", "-p", String(APP)], { env, stdio: ["ignore", "pipe", "pipe"] });
let appLog = "";
app.stdout.on("data", (d) => (appLog += d));
app.stderr.on("data", (d) => (appLog += d));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
try {
  await waitFor(`${BASE}/offline`);

  // 1) Startseite mit echten (nachgebildeten) Daten
  const t0 = Date.now();
  const home = await fetch(`${BASE}/`);
  const html = await home.text();
  check("Startseite antwortet", home.ok, `${Date.now() - t0} ms (inkl. Kompilieren)`);
  check("Kein reiner Demo-Modus", !html.includes(">Demo<") || html.includes("Teils Demo"));
  check("Mischbetrieb gekennzeichnet (XETRA per Demo-Fallback)", html.includes("Teils Demo"));

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // 2) Detailseite: Echtzeit-Status und Kurse aus dem WebSocket-Relay
  await page.goto(`${BASE}/aktie/NVDA`, { waitUntil: "load" });
  const status = page.getByRole("status").filter({ hasText: "Echtzeit" }).first();
  let realtime = true;
  try {
    await status.waitFor({ timeout: 45_000 });
  } catch {
    realtime = false;
  }
  check("Status „Echtzeit“ sichtbar", realtime);
  const priceEl = page.locator("article p.tnum").first();
  const seen = new Set();
  for (let i = 0; i < 12; i++) {
    seen.add((await priceEl.textContent())?.trim());
    await page.waitForTimeout(500);
  }
  check("Kurs aktualisiert sich live", seen.size >= 3, `${seen.size} verschiedene Werte in 6 s`);
  const stats = await (await fetch(`http://127.0.0.1:${FAKE}/__stats`)).json();
  const shown = Number(String([...seen].pop()).replace(/[^\d,]/g, "").replace(",", "."));
  const lastTrade = stats.last.NVDA;
  check(
    "Angezeigter Kurs = letzter Trade des Anbieters",
    Number.isFinite(shown) && lastTrade && Math.abs(shown / lastTrade - 1) < 0.01,
    `angezeigt ${shown}, letzter Trade ${lastTrade}`,
  );
  check("Relay hat NVDA abonniert", stats.subscribed.includes("NVDA"), `abonniert: ${stats.subscribed.join(", ")}`);
  await page.screenshot({ path: `${OUT}/detail-echtzeit.png` });

  // 3) Live-API: US in Echtzeit, XETRA per Demo-Fallback, Indizes über ETF-Proxy
  const live = await (await fetch(`${BASE}/api/live?s=NVDA,SAP.DE,SPX&format=json`)).json();
  const by = Object.fromEntries(live.ticks.map((t) => [t.s, t]));
  check("Live-API meldet Modus „realtime“", live.mode === "realtime", `mode=${live.mode}`);
  check("NVDA kommt aus Echtzeit-Trades", by.NVDA?.q === "rt", `q=${by.NVDA?.q}`);
  check("SAP.DE über Demo-Fallback (gekennzeichnet)", by["SAP.DE"]?.q === "sim", `q=${by["SAP.DE"]?.q}`);

  // 4) Weitere Seiten und eine einzige Relay-Verbindung für alle Tabs
  const page2 = await ctx.newPage();
  await page2.goto(`${BASE}/`, { waitUntil: "load" });
  await page2.waitForTimeout(4_000);
  await page2.screenshot({ path: `${OUT}/start-echtzeit.png` });
  const stats2 = await (await fetch(`http://127.0.0.1:${FAKE}/__stats`)).json();
  check("Eine WebSocket-Verbindung zum Anbieter für alle Browser-Tabs", stats2.connections === 1, `${stats2.connections} Verbindung(en)`);
  check("Relay abonniert höchstens 50 Symbole", stats2.subscribed.length <= 50, `${stats2.subscribed.length} Symbole`);
  await page2.goto(`${BASE}/entdecken`, { waitUntil: "load" });
  check("Entdecken lädt", await page2.getByRole("heading", { level: 1, name: "Entdecken" }).isVisible());
  await page2.goto(`${BASE}/heatmap`, { waitUntil: "load" });
  await page2.getByTestId("heatmap-tile").first().waitFor({ timeout: 30_000 });
  check("Heatmap zeigt Kacheln", (await page2.getByTestId("heatmap-tile").count()) > 10);

  // 5) Nicht gescannter Wert (Small Cap) ist trotzdem abrufbar
  await page2.goto(`${BASE}/aktie/RGTI`, { waitUntil: "load" });
  check("Nicht gescannter Wert (RGTI) hat eine Detailseite", await page2.getByRole("heading", { level: 1, name: "Rigetti Computing" }).isVisible());

  // 6) Verbindung weg → ehrlich „delayed“, dann selbstständige Neuverbindung
  fake.control.reject = true;
  for (const client of fake.wss.clients) client.terminate();
  await page.waitForTimeout(1_500);
  const during = await (await fetch(`${BASE}/api/live?s=NVDA&format=json`)).json();
  check("Während des Ausfalls „delayed“ statt „realtime“", during.mode === "delayed", `mode=${during.mode}`);
  check("Letzter Kurs bleibt sichtbar, als verzögert markiert", during.ticks[0]?.q === "delayed", `q=${during.ticks[0]?.q}`);
  await page.getByRole("status").filter({ hasText: "Verzögert" }).first().waitFor({ timeout: 10_000 }).then(
    () => check("UI zeigt „Verzögert“", true),
    () => check("UI zeigt „Verzögert“", false),
  );
  fake.control.reject = false;
  await page.getByRole("status").filter({ hasText: "Echtzeit" }).first().waitFor({ timeout: 70_000 }).then(
    () => check("Relay verbindet sich selbst neu, UI wieder „Echtzeit“", true),
    () => check("Relay verbindet sich selbst neu, UI wieder „Echtzeit“", false),
  );
  const stats3 = await (await fetch(`http://127.0.0.1:${FAKE}/__stats`)).json();
  check("Neue Verbindung aufgebaut", stats3.connections >= 2, `${stats3.connections} Verbindungen insgesamt`);

  check("Keine JavaScript-Fehler im Browser", errors.length === 0, errors.join(" | "));
} catch (e) {
  check("Ablauf", false, String(e));
  console.log(appLog.slice(-3000));
} finally {
  await browser.close();
  app.kill("SIGTERM");
  fake.wss.close();
  fake.server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden. Screenshots: ${OUT}/`);
process.exit(failed.length ? 1 : 0);
