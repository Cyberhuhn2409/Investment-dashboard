import type { Page } from "@playwright/test";

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 1024;

/** Hauptnavigation: Tab-Leiste (mobil) bzw. Seitenleiste (Desktop). */
export async function navigate(page: Page, label: "Start" | "Heatmap" | "Entdecken" | "Watchlist") {
  await page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: label, exact: true }).click();
}

export async function openSearch(page: Page) {
  if (isMobile(page)) {
    await page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("button", { name: "Suche" }).click();
  } else {
    await page.keyboard.press("Control+k");
  }
}
