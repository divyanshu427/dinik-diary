import { defineConfig, devices } from "@playwright/test";

/** Saved by tests/e2e/global.setup.ts: the app after "Start all" on the first-run question. */
const STARTED = "tests/e2e/.state/started.json";

// Tests run against a production build on their own port, so they never clash with
// `npm run dev` on port 3000. Run `npm run build` first (the `e2e` script does this).
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  // Every e2e test runs on a laptop-sized and a phone-sized screen.
  projects: [
    // Answers the first-run question once; the others start from that saved state.
    { name: "setup", testMatch: /global\.setup\.ts/ },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], storageState: STARTED },
      dependencies: ["setup"],
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], storageState: STARTED },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
