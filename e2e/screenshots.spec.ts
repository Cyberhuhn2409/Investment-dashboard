import { mkdirSync } from "node:fs";
import { test, type Browser, type Page } from "@playwright/test";

const OUT = "screenshots";
const WIDTHS = [390, 1440] as const;
const THEMES = ["dark", "light"] as const;

interface Shot {
  name: string;
  path: string;
  /** Ganze Seite (Viewport auf Inhaltshöhe) statt nur sichtbarer Bereich. */
  full?: boolean;
  watchlist?: string[];
  /** Netzwerk vor dem Laden manipulieren (für Zustände wie Laden/Fehler/veraltet). */
  route?: (page: Page) => Promise<void>;
  prepare?: (page: Page, width: number) => Promise<void>;
}

const WL = ["NVDA", "SAP.DE", "TSLA", "RHM.DE"];

const SHOTS: Shot[] = [
  { name: "01-start", path: "/", full: true },
  { name: "02-heatmap", path: "/heatmap" },
  {
    name: "03-heatmap-sektor",
    path: "/heatmap",
    prepare: async (page) => {
      await page.getByRole("button", { name: "Technologie vergrößern" }).click();
      await page.waitForTimeout(900);
    },
  },
  { name: "04-entdecken", path: "/entdecken", full: true },
  {
    name: "05-entdecken-filter",
    path: "/entdecken?ansicht=alle&groesse=mid,small&typ=buzz,momentum",
    prepare: async (page, width) => {
      if (width < 1280) {
        await page.getByRole("button", { name: /Filter öffnen/ }).click();
        await page.waitForTimeout(700);
      }
    },
  },
  { name: "06-detail", path: "/aktie/NVDA", full: true },
  {
    name: "07-detail-scrubbing",
    path: "/aktie/RHM.DE",
    prepare: async (page) => {
      await page.getByRole("radio", { name: "1 Jahr" }).click();
      await page.waitForTimeout(900);
      const box = await page.locator("canvas").first().boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.5);
        await page.waitForTimeout(400);
      }
    },
  },
  { name: "08-watchlist", path: "/watchlist", full: true, watchlist: ["NVDA", "SAP.DE", "TSLA", "RHM.DE", "AAPL", "BAYN.DE"] },
  { name: "09-watchlist-leer", path: "/watchlist", full: true, watchlist: [] },
  {
    name: "10-suche",
    path: "/",
    prepare: async (page, width) => {
      if (width < 1024) await page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("button", { name: "Suche" }).click();
      else await page.keyboard.press("Control+k");
      await page.getByRole("combobox").fill("deutsche");
      await page.waitForTimeout(500);
    },
  },
  // Gestaltete Zustände
  {
    name: "11-zustand-laden",
    path: "/watchlist",
    watchlist: WL,
    route: (page) => page.route("**/api/rows**", () => new Promise(() => {})),
  },
  {
    name: "12-zustand-fehler",
    path: "/watchlist",
    watchlist: WL,
    route: (page) => page.route("**/api/rows**", (r) => r.fulfill({ status: 502, body: "{}" })),
  },
  {
    name: "13-zustand-veraltet",
    path: "/watchlist",
    watchlist: WL,
    route: (page) =>
      page.route("**/api/rows**", async (r) => {
        const res = await r.fetch();
        const json = await res.json();
        json.status.stale = true;
        json.status.asOf = json.status.generatedAt - 3 * 3_600_000;
        await r.fulfill({ response: res, json });
      }),
  },
  { name: "14-zustand-keine-treffer", path: "/entdecken?region=DE&min=90" },
  { name: "15-zustand-nicht-gefunden", path: "/aktie/XYZ123" },
  {
    name: "16-heatmap-smallcaps-relevant",
    path: "/heatmap",
    prepare: async (page) => {
      await page.getByRole("radio", { name: "Small Caps" }).click();
      await page.getByRole("button", { name: "Relevante hervorheben" }).click();
      await page.waitForTimeout(900);
    },
  },
  { name: "17-entdecken-alle-mdax", path: "/entdecken?ansicht=alle&index=MDAX&sort=change", full: true },
];

async function capture(browser: Browser, shot: Shot, width: number, theme: string, baseURL: string) {
  const mobile = width < 1024;
  const context = await browser.newContext({
    baseURL,
    viewport: { width, height: mobile ? 844 : 900 },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion: "no-preference",
  });
  await context.addInitScript(
    ([t, wl]) => {
      localStorage.setItem("signal:theme", t!);
      localStorage.setItem("signal:watchlist", wl!);
    },
    [theme, JSON.stringify(shot.watchlist ?? [])],
  );
  const page = await context.newPage();
  if (shot.route) await shot.route(page);
  await page.goto(shot.path, { waitUntil: "load" });
  // Live-Stream startet nach dem ersten Rendern → Status „Live“ abwarten
  await page.waitForTimeout(2600);
  if (shot.prepare) await shot.prepare(page, width);
  if (shot.full) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: `${OUT}/${shot.name}-${width}-${theme}.png` });
  await context.close();
}

test("Screenshots aller Screens", async ({ browser, baseURL }) => {
  mkdirSync(OUT, { recursive: true });
  // Optional nur einzelne Motive: SHOTS=15,16 npm run screenshots
  const only = process.env.SHOTS?.split(",").filter(Boolean);
  for (const shot of SHOTS.filter((s) => !only || only.some((o) => s.name.startsWith(o)))) {
    for (const width of WIDTHS) {
      for (const theme of THEMES) {
        await capture(browser, shot, width, theme, baseURL!);
      }
    }
  }
});
