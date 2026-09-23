import { defineConfig, devices } from "@playwright/test";

/**
 * E2E-Tests gegen den Produktions-Build (`npm run build` vorher).
 * MOCK_NOW friert die Demo-Daten ein (auch beim Build setzen, siehe README).
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  testIgnore: /screenshots\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/offline`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { MOCK_NOW: process.env.MOCK_NOW ?? "2026-09-23T18:30:00Z" },
  },
});
