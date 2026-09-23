// Dev-Hilfe: node scripts/shot.mjs <url> <out.png> [width] [theme] [fullPage]
import { chromium } from "@playwright/test";
const [url, out, width = "390", theme = "dark", full = "1"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
const w = Number(width);
const ctx = await browser.newContext({
  viewport: { width: w, height: w < 800 ? 844 : 900 },
  deviceScaleFactor: w < 800 ? 2 : 1,
  isMobile: w < 800,
  hasTouch: w < 800,
});
await ctx.addInitScript((t) => localStorage.setItem("signal:theme", t), theme);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: out, fullPage: full === "1" });
if (errors.length) console.log("ERRORS:\n" + errors.join("\n"));
await browser.close();
