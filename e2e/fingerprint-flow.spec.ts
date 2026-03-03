import { test, expect } from "@playwright/test";

/**
 * Test E2E rejestracji przez /form:
 *
 * 1. Otwórz /form → wypełnij formularz → wyślij
 *    - Fingerprint SDK może nie działać w headless (getData() fallback → unknown)
 *    - Playwright wysyła x-e2e-secret header (extraHTTPHeaders w playwright.config)
 *    - /api/fetch-proxy wykrywa E2E header → pomija weryfikację Fingerprint
 *    - Konto zostaje utworzone
 *
 * WYMAGANE: E2E_SECRET w .env
 */

test("Rejestracja przez /form → sukces", async ({ page }) => {
  await page.goto("/form");

  // Wypełnij formularz
  await page.fill('input[id="name"]', "Test User");
  await page.fill('input[id="email"]', "test@example.com");
  await page.fill('input[id="password"]', "haslo123");

  // Wyślij
  await page.click('button[type="submit"]');

  // Czekaj na odpowiedź — sukces lub błąd
  const result = await Promise.race([
    page.waitForSelector("text=Konto zostało utworzone", { timeout: 30_000 }).then(() => "success"),
    page.waitForSelector("text=❌", { timeout: 30_000 }).then(() => "error"),
  ]);

  if (result === "error") {
    const errorText = await page.textContent("[class*='bg-red']");
    throw new Error(`Rejestracja zwróciła błąd: ${errorText}`);
  }

  // Sprawdź czy wyświetla się userId
  const successBox = await page.textContent("[class*='bg-green']");
  expect(successBox).toContain("Konto zostało utworzone");
});
