// Erzeugt PNG-Icons (PWA, Apple Touch) aus public/icon.svg mit Chromium.
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";

const svg = await readFile(new URL("../public/icon.svg", import.meta.url), "utf8");
const targets = [
  { file: "icon-192.png", size: 192, pad: 0, bg: "transparent" },
  { file: "icon-512.png", size: 512, pad: 0, bg: "transparent" },
  { file: "icon-maskable-512.png", size: 512, pad: 0.12, bg: "#7b68ee" },
  { file: "apple-touch-icon.png", size: 180, pad: 0, bg: "#0b0716" },
];

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
const page = await browser.newPage();
for (const t of targets) {
  const inner = Math.round(t.size * (1 - t.pad * 2));
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;background:${t.bg};display:grid;place-items:center;width:${t.size}px;height:${t.size}px">` +
      `<div style="width:${inner}px;height:${inner}px">${svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
  );
  const buf = await page.screenshot({ omitBackground: t.bg === "transparent", type: "png" });
  await writeFile(new URL(`../public/icons/${t.file}`, import.meta.url), buf);
  console.log("✓", t.file);
}
await browser.close();
