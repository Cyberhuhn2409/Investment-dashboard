import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = ["/", "/heatmap", "/entdecken", "/aktie/NVDA", "/aktie/SAP.DE", "/watchlist"];

for (const theme of ["dark", "light"] as const) {
  test.describe(`Barrierefreiheit (${theme})`, () => {
    test.beforeEach(async ({ context }) => {
      await context.addInitScript(
        ([t]) => {
          localStorage.setItem("signal:theme", t!);
          localStorage.setItem("signal:watchlist", JSON.stringify(["NVDA", "SAP.DE", "TSLA"]));
        },
        [theme],
      );
    });

    for (const path of PAGES) {
      test(`${path} erfüllt WCAG 2.2 AA`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await page.waitForTimeout(800);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          // Chart-Canvas hat eine textuelle Beschreibung (sr-only) daneben
          .exclude("canvas")
          .analyze();
        const summary = results.violations.map(
          (v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`,
        );
        expect(summary, summary.join("\n")).toEqual([]);
      });
    }
  });
}
