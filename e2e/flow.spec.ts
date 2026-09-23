import { expect, test } from "@playwright/test";
import { isMobile, navigate, openSearch } from "./helpers";

test.describe("Hauptablauf", () => {
  test("Start → Heatmap → Kachel → Detail → Watchlist → Suche", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // Start
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Signal" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Indizes" }).getByText("S&P 500")).toBeVisible();
    await expect(page.getByRole("list", { name: "Top-Signale" }).getByRole("link").first()).toBeVisible();
    await expect(page.getByText("DEMO").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Segment-Radar" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Small Caps: \d+ von \d+ Werten relevant/ })).toBeVisible();

    // Live-Kurse: Stream startet nach dem ersten Rendern, Kurse ticken
    await expect(page.getByRole("status").filter({ hasText: "Live · simuliert" }).filter({ visible: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator(".tick-up, .tick-down").first()).toBeAttached({ timeout: 15_000 });

    // Heatmap
    await navigate(page, "Heatmap");
    await expect(page).toHaveURL(/\/heatmap$/);
    await expect(page.getByRole("heading", { level: 1, name: "Heatmap" })).toBeVisible();
    const tiles = page.getByTestId("heatmap-tile");
    await expect(tiles.first()).toBeVisible();
    expect(await tiles.count()).toBeGreaterThan(150);

    // Einfärbung umschalten
    await page.getByRole("radio", { name: "Buzz" }).click();
    await expect(page.getByRole("radio", { name: "Buzz" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("radio", { name: "Kurs" }).click();

    // Sektor-Zoom
    await page.getByRole("button", { name: "Technologie vergrößern" }).click();
    await expect(page.getByRole("button", { name: /Alle Sektoren/ })).toBeVisible();
    await expect(page.locator('[data-testid="heatmap-tile"][data-symbol="AAPL"]')).toBeVisible();

    // Kachel → Detail
    await page.locator('[data-testid="heatmap-tile"][data-symbol="NVDA"]').click();
    await expect(page).toHaveURL(/\/aktie\/NVDA$/);
    await expect(page.getByRole("heading", { level: 1, name: "Nvidia" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Warum markiert?" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Rechtlicher Hinweis" })).toContainText("Keine Anlageberatung.");
    await expect(page.getByRole("heading", { name: "Top-Diskussionen" })).toBeVisible();

    // Chart: Zeitraum wechseln lädt Daten serverseitig
    await expect(page.locator("canvas").first()).toBeVisible();
    const chartResponse = page.waitForResponse((r) => r.url().includes("/api/chart/NVDA") && r.url().includes("range=5Y"));
    await page.getByRole("radio", { name: "5 Jahre" }).click();
    expect((await chartResponse).status()).toBe(200);
    await expect(page.getByRole("radio", { name: "5 Jahre" })).toHaveAttribute("aria-checked", "true");

    // Zur Watchlist hinzufügen
    const toggle = page.getByTestId("watchlist-toggle").filter({ visible: true }).first();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    // Watchlist
    await navigate(page, "Watchlist");
    await expect(page).toHaveURL(/\/watchlist$/);
    const list = page.getByTestId("watchlist");
    await expect(list.getByText("Nvidia")).toBeVisible();

    // Suche
    await openSearch(page);
    const input = page.getByRole("combobox", { name: "Name, Ticker oder Stichwort" });
    await expect(input).toBeFocused();
    await input.fill("SAP");
    await expect(page.getByRole("option").first()).toContainText("SAP");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/aktie\/SAP\.DE$/);
    await expect(page.getByRole("heading", { level: 1, name: "SAP" })).toBeVisible();

    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test.describe("Entdecken", () => {
  test("zeigt zuerst relevante Werte, filtert nach Größe, Typ und Score", async ({ page }) => {
    await page.goto("/entdecken");
    await expect(page.getByRole("heading", { level: 1, name: "Entdecken" })).toBeVisible();
    const status = page.getByRole("status").filter({ hasText: /\d+\s+(relevanter?\s+)?Wert/ }).first();
    await expect(status).toContainText("relevante Werte");
    const relevant = Number((await status.locator(".tnum").first().textContent()) ?? "0");
    expect(relevant).toBeGreaterThan(20);
    expect(relevant).toBeLessThan(300);

    // Alle Werte
    await page.getByRole("radio", { name: /^Alle Werte/ }).click();
    await expect(status).toContainText("531");
    await expect(page).toHaveURL(/ansicht=alle/);

    // Größenklasse
    await page.getByRole("button", { name: "Small Caps" }).first().click();
    await expect(page).toHaveURL(/groesse=small/);
    await expect(status).not.toContainText("531");

    // Signaltyp + Mindest-Score über Filterpanel/Sheet
    if (isMobile(page)) await page.getByRole("button", { name: /Filter öffnen/ }).click();
    await page.getByRole("button", { name: "Nachrichtenwelle" }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/typ=news/);
    const slider = page.getByRole("slider", { name: "Mindest-Score" }).filter({ visible: true });
    await slider.fill("90");
    if (isMobile(page)) await page.getByRole("button", { name: /Ergebnis/ }).click();
    await expect(page.getByText("Keine Werte für diese Filter")).toBeVisible();
    await page.getByRole("button", { name: "Filter zurücksetzen" }).click();
    await expect(status).toContainText(String(relevant));
  });

  test("übernimmt Filter aus der URL", async ({ page }) => {
    await page.goto("/entdecken?region=DE&sort=name&ansicht=alle");
    await expect(page.getByRole("status").filter({ hasText: "Werte" }).first()).toContainText("126");
    await page.goto("/entdecken?index=MDAX&ansicht=alle");
    await expect(page.getByRole("status").filter({ hasText: "Werte" }).first()).toContainText("45");
  });
});

test.describe("Zustände", () => {
  test("leere Watchlist mit Vorschlägen", async ({ page }) => {
    await page.goto("/watchlist");
    await expect(page.getByRole("heading", { name: "Deine Watchlist ist leer" })).toBeVisible();
    await page.getByRole("button", { name: /zur Watchlist hinzufügen/ }).first().click();
    await expect(page.getByTestId("watchlist").getByRole("link")).toHaveCount(1);
  });

  test("unbekanntes Symbol zeigt Nicht-gefunden-Seite", async ({ page }) => {
    const res = await page.goto("/aktie/XYZ123");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
  });

  test("Theme-Umschalter wechselt auf Hell und merkt sich die Wahl", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Helles Design aktivieren" }).filter({ visible: true }).first().click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("API liefert Chartdaten und validiert Eingaben", async ({ request }) => {
    const ok = await request.get("/api/chart/AAPL?range=1D");
    expect(ok.status()).toBe(200);
    const json = await ok.json();
    expect(json.points.length).toBeGreaterThan(10);
    expect((await request.get("/api/chart/AAPL?range=7X")).status()).toBe(400);
    expect((await request.get("/api/chart/NOPE?range=1M")).status()).toBe(404);
  });

  test("Live-API liefert Ticks und validiert Symbole", async ({ request }) => {
    const ok = await request.get("/api/live?s=NVDA,SAP.DE,SPX&format=json");
    expect(ok.status()).toBe(200);
    const json = (await ok.json()) as { mode: string; ticks: { s: string; q: string; m: number }[] };
    expect(json.mode).toBe("sim");
    expect(json.ticks.map((t) => t.s).sort()).toEqual(["NVDA", "SAP.DE", "SPX"]);
    expect((await request.get("/api/live?s=NOPE")).status()).toBe(400);
  });
});
