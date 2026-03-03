/**
 * Bot Detection Test Suite
 * Testuje formularz zabezpieczony Fingerprint Pro w 3 wariantach:
 *   1. Raw HTTP (curl-level) — brak JS, brak fingerprint
 *   2. Puppeteer headless — JS działa, ale headless jest wykrywalny
 *   3. Puppeteer headless + stealth — maskuje sygnały headless
 *
 * Użycie:
 *   npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
 *   node bot-test.mjs
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const FORM_URL = `${BASE_URL}/form`;
const FORM_ENDPOINT = `${BASE_URL}/api/fetch-proxy`;

const FAKE_DATA = {
  email: "bot@test.com",
  name: "Bot User",
  password: "BotPass123!",
  requestId: "test-request-id-12345", // Kluczowy element — brak tego powinien skutkować blokadą
  visitorId: "test-visitor-id-67890", // Opcjonalny, ale może pomóc w diagnostyce
};

// ─── Helpers ────────────────────────────────────────────────────────

function log(variant, status, detail) {
  const icon = status === "BLOCKED" ? "🛡️" : status === "PASSED" ? "⚠️" : "ℹ️";
  console.log(`${icon} [${variant}] ${status}: ${detail}`);
}

async function analyzeResponse(variant, response) {
  const status = response.status ?? response.statusCode;
  let body;

  if (typeof response.json === "function") {
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
  } else {
    body = response;
  }

  console.log(`   HTTP ${status} | Body:`, JSON.stringify(body).slice(0, 300));

  if (status >= 400 || body?.error) {
    const reason = body?.details?.botResult
      ? `Bot result: ${body.details.botResult}`
      : body?.error ?? `HTTP ${status}`;
    log(variant, "BLOCKED", `Formularz odrzucił request (${reason})`);
  } else {
    log(variant, "PASSED", "Request przeszedł — bot NIE został wykryty");
  }

  return { status, body };
}

// ─── Wariant 1: Raw HTTP (bez przeglądarki) ─────────────────────────

async function testRawHttpWithFakeData() {
  console.log("\n━━━ WARIANT 1: Raw HTTP z fake requestId i visitorId ━━━");

  try {
    const res = await fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(FAKE_DATA),
    });
    await analyzeResponse("Raw HTTP", res);
  } catch (err) {
    log("Raw HTTP", "ERROR", err.message);
  }
}

// ─── Wariant 2: Raw HTTP (bez requestId i visitorId) ──────────────

async function testRawHttpWithoutFingerprint() {
  console.log("\n━━━ WARIANT 2: Raw HTTP bez requestId i visitorId ━━━");

  const { requestId, visitorId, ...dataWithoutFingerprint } = FAKE_DATA;

  try {
    const res = await fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dataWithoutFingerprint),
    });
    await analyzeResponse("Raw HTTP (no fingerprint)", res);
  } catch (err) {
    log("Raw HTTP (no fingerprint)", "ERROR", err.message);
  }
}

// ─── Wariant 3: Puppeteer headless (standard) ──────────────────────

async function testHeadless() {
  console.log("\n━━━ WARIANT 3: Puppeteer Headless (standard) ━━━");

  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // Interceptujemy response z submit
    let submitResponse = null;

    page.on("response", async (res) => {
      if (res.url().includes("fetch-proxy")) {
        submitResponse = { status: res.status(), body: await res.json().catch(() => null) };
      }
    });

    await page.goto(FORM_URL, { waitUntil: "networkidle2", timeout: 15000 });

    // Wypełnienie formularza
    await fillForm(page);
    await submitForm(page);

    // Czekamy na response
    await new Promise(r => setTimeout(r, 5000));

    if (submitResponse) {
      console.log(`   HTTP ${submitResponse.status} | Body:`, JSON.stringify(submitResponse.body).slice(0, 300));
      if (submitResponse.status >= 400 || submitResponse.body?.error) {
        const reason = submitResponse.body?.details?.botResult
          ? `Bot result: ${submitResponse.body.details.botResult}`
          : submitResponse.body?.error ?? `HTTP ${submitResponse.status}`;
        log("Headless", "BLOCKED", `Bot wykryty (${reason})`);
      } else {
        log("Headless", "PASSED", "Bot NIE wykryty");
      }
    } else {
      log("Headless", "INFO", "Brak przechwyconego response — formularz mógł nie wysłać requestu (brak fingerprint)");
    }

    // Dodatkowa diagnostyka — sygnały headless
    const signals = await page.evaluate(() => ({
      webdriver: navigator.webdriver,
      languages: navigator.languages,
      plugins: navigator.plugins.length,
      userAgent: navigator.userAgent,
    }));
    console.log("   Headless signals:", JSON.stringify(signals));
  } finally {
    await browser.close();
  }
}

// ─── Wariant 4: Puppeteer + Stealth Plugin ──────────────────────────

async function testStealth() {
  console.log("\n━━━ WARIANT 4: Puppeteer Headless + Stealth ━━━");

  const puppeteerExtra = await import("puppeteer-extra");
  const StealthPlugin = await import("puppeteer-extra-plugin-stealth");

  puppeteerExtra.default.use(StealthPlugin.default());

  const browser = await puppeteerExtra.default.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    let submitResponse = null;

    page.on("response", async (res) => {
      if (res.url().includes("fetch-proxy")) {
        submitResponse = { status: res.status(), body: await res.json().catch(() => null) };
      }
    });

    await page.goto(FORM_URL, { waitUntil: "networkidle2", timeout: 15000 });

    await fillForm(page);
    await submitForm(page);

    await new Promise(r => setTimeout(r, 5000));

    if (submitResponse) {
      console.log(`   HTTP ${submitResponse.status} | Body:`, JSON.stringify(submitResponse.body).slice(0, 300));
      if (submitResponse.status >= 400 || submitResponse.body?.error) {
        const reason = submitResponse.body?.details?.botResult
          ? `Bot result: ${submitResponse.body.details.botResult}`
          : submitResponse.body?.error ?? `HTTP ${submitResponse.status}`;
        log("Stealth", "BLOCKED", `Bot wykryty mimo stealth (${reason})`);
      } else {
        log("Stealth", "PASSED", "Bot NIE wykryty — stealth przeszedł!");
      }
    } else {
      log("Stealth", "INFO", "Brak przechwyconego response — formularz mógł nie wysłać requestu (brak fingerprint)");
    }

    const signals = await page.evaluate(() => ({
      webdriver: navigator.webdriver,
      languages: navigator.languages,
      plugins: navigator.plugins.length,
      userAgent: navigator.userAgent,
    }));
    console.log("   Stealth signals:", JSON.stringify(signals));
  } finally {
    await browser.close();
  }
}

// ─── Form interaction helpers ───────────────────────────────────────

async function fillForm(page) {
  // Dostosuj selektory do swojego formularza
  // Warianty: input[name="..."], input[id="..."], input[type="..."]
  // Formularz używa id="name", id="email", id="password"
  const selectors = {
    name: '#name',
    email: '#email',
    password: '#password',
  };

  for (const [field, selector] of Object.entries(selectors)) {
    const el = await page.$(selector);
    if (el) {
      await el.click({ clickCount: 3 }); // zaznacz istniejący tekst
      await el.type(FAKE_DATA[field], { delay: 50 }); // symulacja ludzkiego pisania
      console.log(`   ✓ Filled ${field}`);
    } else {
      console.log(`   ✗ Selector not found: ${selector}`);
    }
  }
}

async function submitForm(page) {
  // Selektor submit — formularz ma button[type="submit"] z tekstem "Załóż konto"
  const btn = await page.$('button[type="submit"]');
  if (btn) {
    await btn.click();
    console.log("   ✓ Form submitted");
  } else {
    // Fallback — szukaj dowolnego buttona
    const fallback = await page.$("button");
    if (fallback) {
      await fallback.click();
      console.log("   ✓ Form submitted (fallback button)");
    } else {
      console.log("   ✗ Submit button not found");
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   Bot Detection Test Suite                   ║");
  console.log("║   Target: " + BASE_URL.padEnd(35) + "║");
  console.log("╚══════════════════════════════════════════════╝");

  await testRawHttpWithFakeData();
  await testRawHttpWithoutFingerprint();
  await testHeadless();
  await testStealth();

  console.log("\n━━━ PODSUMOWANIE ━━━");
  console.log("Wariant 1 (Raw HTTP z fake ID)    → powinien być blokowany (fake requestId)");
  console.log("Wariant 2 (Raw HTTP bez ID)       → powinien być ZAWSZE blokowany (brak requestId)");
  console.log("Wariant 3 (Headless)              → powinien być blokowany (navigator.webdriver = true)");
  console.log("Wariant 4 (Stealth)               → jeśli przeszedł, Fingerprint nie wykrywa stealth bota");
}

main().catch(console.error);
