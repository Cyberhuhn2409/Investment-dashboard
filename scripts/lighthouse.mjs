// Lighthouse (mobile) gegen den Produktions-Build.
// Aufruf: npm run build && npm run lighthouse   (optional: LH_URL=http://… für einen laufenden Server)
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const PORT = Number(process.env.LH_PORT ?? 3200);
const BASE = process.env.LH_URL ?? `http://127.0.0.1:${PORT}`;
const PAGES = (process.env.LH_PAGES ?? "/,/heatmap,/entdecken,/aktie/NVDA,/watchlist").split(",");
const THRESHOLDS = { performance: 90, accessibility: 95 };

const chromePath =
  process.env.CHROME_PATH ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

async function waitFor(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server startet noch
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server unter ${url} nicht erreichbar`);
}

let server;
if (!process.env.LH_URL) {
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    env: { ...process.env, MOCK_NOW: process.env.MOCK_NOW ?? "2026-09-23T18:30:00Z" },
    stdio: "ignore",
  });
}

const results = [];
let chrome;
try {
  await waitFor(`${BASE}/offline`);
  chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  await mkdir(".lighthouse", { recursive: true });
  for (const path of PAGES) {
    const url = `${BASE}${path}`;
    // Einmal „aufwärmen“, damit ISR/Cache nicht die erste Messung verfälschen
    await fetch(url).catch(() => {});
    const runner = await lighthouse(url, {
      port: chrome.port,
      output: ["json", "html"],
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      formFactor: "mobile",
      screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
      throttlingMethod: "simulate",
    });
    const lhr = runner.lhr;
    const score = (k) => Math.round((lhr.categories[k]?.score ?? 0) * 100);
    const row = {
      page: path,
      performance: score("performance"),
      accessibility: score("accessibility"),
      bestPractices: score("best-practices"),
      seo: score("seo"),
      lcp: lhr.audits["largest-contentful-paint"]?.displayValue,
      tbt: lhr.audits["total-blocking-time"]?.displayValue,
      cls: lhr.audits["cumulative-layout-shift"]?.displayValue,
    };
    results.push(row);
    const slug = path === "/" ? "start" : path.replace(/\//g, "_").replace(/^_/, "");
    const [json, html] = runner.report;
    await writeFile(`.lighthouse/${slug}.json`, json);
    await writeFile(`.lighthouse/${slug}.html`, html);
    const failing = lhr.categories.accessibility.auditRefs
      .filter((a) => lhr.audits[a.id]?.score === 0 && a.weight > 0)
      .map((a) => a.id);
    console.log(
      `${path.padEnd(14)} Perf ${String(row.performance).padStart(3)} · A11y ${String(row.accessibility).padStart(3)} · BP ${row.bestPractices} · SEO ${row.seo} · LCP ${row.lcp} · TBT ${row.tbt} · CLS ${row.cls}` +
        (failing.length ? `\n               A11y-Probleme: ${failing.join(", ")}` : ""),
    );
  }
} finally {
  await chrome?.kill();
  server?.kill();
}

await writeFile(".lighthouse/summary.json", JSON.stringify(results, null, 2));
const failed = results.filter((r) => r.performance < THRESHOLDS.performance || r.accessibility < THRESHOLDS.accessibility);
if (failed.length) {
  console.error(`\n✗ Schwellen verfehlt (Performance ≥ ${THRESHOLDS.performance}, Accessibility ≥ ${THRESHOLDS.accessibility}):`, failed.map((f) => f.page).join(", "));
  process.exit(1);
}
console.log(`\n✓ Alle Seiten erfüllen Performance ≥ ${THRESHOLDS.performance} und Accessibility ≥ ${THRESHOLDS.accessibility}.`);
