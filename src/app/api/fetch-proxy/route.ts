import {
  FingerprintJsServerApiClient,
  Region,
} from "@fingerprintjs/fingerprintjs-pro-server-api";
import { NextResponse } from "next/server";
import { addAccount } from "@/lib/accounts";
import { addToBlacklist, isBlacklisted } from "@/lib/blacklist";
import { addVisitor } from "@/lib/visitors";

const CONFIDENCE_THRESHOLD = 0.9;

const client = new FingerprintJsServerApiClient({
  apiKey: process.env.FINGERPRINT_SECRET_API_KEY ?? "",
  region: Region.EU,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, visitorId, requestId } = body;

    // --- Prosta walidacja ---
    if (!name || !email || !password || !visitorId || !requestId) {
      return NextResponse.json(
        { error: "Wszystkie pola są wymagane (name, email, password, visitorId, requestId)" },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Nieprawidłowy format email" },
        { status: 400 },
      );
    }

    // --- E2E bypass: pomiń weryfikację Fingerprint ---
    const e2eSecret = request.headers.get("x-e2e-secret");
    const isE2E = e2eSecret !== null && e2eSecret === process.env.E2E_SECRET;

    if (isE2E) {
      console.log(`[Proxy] E2E bypass — pomijam weryfikację Fingerprint`);

      const userId = crypto.randomUUID();
      addVisitor({
        visitorId,
        confidence: 0,
        requestId,
        botResult: null,
        timestamp: new Date().toISOString(),
        blocked: false,
        reason: "E2E bypass",
      });
      addAccount({
        userId,
        name,
        email,
        visitorId,
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json(
        { success: true, message: "Konto zostało utworzone", userId, name, email },
        { status: 201 },
      );
    }

    // --- Krok 1: Server-side verification via Fingerprint Server API ---
    console.log(`[Proxy] Weryfikacja requestId: ${requestId}`);

    let event: Awaited<ReturnType<typeof client.getEvent>>;
    try {
      event = await client.getEvent(requestId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Proxy] Błąd weryfikacji Fingerprint: ${message}`);
      return NextResponse.json(
        { error: "Nie udało się zweryfikować fingerprint" },
        { status: 500 },
      );
    }

    // --- Krok 2: Zbierz dane do logowania ---
    const botData = event.products?.botd?.data;
    const botResult = botData?.bot?.result ?? null;
    const identification = event.products?.identification?.data;
    const confidenceScore = identification?.confidence?.score ?? 0;

    // --- Krok 3: Sprawdzenie blacklisty ---
    if (isBlacklisted(visitorId)) {
      console.warn(`[Proxy] Zablokowany visitorId z blacklisty: ${visitorId}`);
      addVisitor({
        visitorId,
        confidence: confidenceScore,
        requestId,
        botResult,
        timestamp: new Date().toISOString(),
        blocked: true,
        reason: "Blacklista",
      });
      return NextResponse.json(
        { error: "Dostęp zablokowany" },
        { status: 403 },
      );
    }

    // --- Krok 4: Bot detection ---
    if (botData) {
      console.log(`[Proxy] Bot detection result: ${botResult}`);

      if (botResult === "bad" || botResult === "good") {
        console.warn(`[Proxy] Bot wykryty (${botResult})! visitorId: ${visitorId}`);
        addToBlacklist(visitorId, `Bot detected (${botResult})`);
        addVisitor({
          visitorId,
          confidence: confidenceScore,
          requestId,
          botResult,
          timestamp: new Date().toISOString(),
          blocked: true,
          reason: `Bot (${botResult})`,
        });
        return NextResponse.json(
          {
            error: "Dostęp zablokowany — wykryto bota",
            details: {
              visitorId,
              requestId,
              botResult,
              confidence: confidenceScore,
              blockedAt: new Date().toISOString(),
            },
          },
          { status: 403 },
        );
      }
    }

    // --- Krok 5: Confidence score check ---
    console.log(`[Proxy] Confidence score: ${confidenceScore}`);

    if (confidenceScore < CONFIDENCE_THRESHOLD) {
      console.warn(
        `[Proxy] ⚠️ Niski confidence score (${confidenceScore}) dla visitorId: ${visitorId}. Logowanie jako podejrzane.`,
      );
      // Przepuszczamy dalej, ale logujemy
    }

    // Zaloguj wizytę
    addVisitor({
      visitorId,
      confidence: confidenceScore,
      requestId,
      botResult,
      timestamp: new Date().toISOString(),
      blocked: false,
      reason: confidenceScore < CONFIDENCE_THRESHOLD ? "Niski confidence" : null,
    });

    // --- Krok 6: Tworzenie konta (bezpośrednio, shared in-memory) ---
    console.log(`[Proxy] ✅ Weryfikacja pozytywna. Tworzę konto.`);

    const userId = crypto.randomUUID();
    addAccount({
      userId,
      name,
      email,
      visitorId,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        message: "Konto zostało utworzone",
        userId,
        name,
        email,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Wewnętrzny błąd serwera" },
      { status: 500 },
    );
  }
}
