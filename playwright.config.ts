import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    screenshot: "only-on-failure",
    extraHTTPHeaders: {
      ...(process.env.E2E_SECRET ? { "x-e2e-secret": process.env.E2E_SECRET } : {}),
    },
  },
  webServer: {
    command: "pnpm dev",
    port: 3000,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
