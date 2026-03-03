import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const isRemote = !!process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
    extraHTTPHeaders: {
      ...(process.env.E2E_SECRET ? { "x-e2e-secret": process.env.E2E_SECRET } : {}),
    },
  },
  ...(isRemote
    ? {}
    : {
        webServer: {
          command: "pnpm dev",
          port: 3000,
          reuseExistingServer: true,
          timeout: 30_000,
        },
      }),
});
