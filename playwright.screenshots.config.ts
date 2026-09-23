import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/** Erzeugt die Screenshots in /screenshots (390 px und 1440 px, Dunkel und Hell). */
export default defineConfig({
  ...base,
  testIgnore: undefined,
  testMatch: /screenshots\.spec\.ts/,
  projects: [{ name: "screenshots", use: { browserName: "chromium" } }],
  timeout: 900_000,
});
