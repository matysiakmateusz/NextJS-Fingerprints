import {
  FingerprintJsServerApiClient,
  Region,
} from "@fingerprintjs/fingerprintjs-pro-server-api";
import { type NextRequest, NextResponse } from "next/server";

const client = new FingerprintJsServerApiClient({
  apiKey: process.env.FINGERPRINT_SECRET_API_KEY!,
  region: Region.EU,
});

export async function GET(request: NextRequest) {
  const visitorId = request.nextUrl.searchParams.get("visitorId");
  const requestId = request.nextUrl.searchParams.get("requestId");

  if (!visitorId && !requestId) {
    return NextResponse.json(
      { error: "visitorId or requestId required" },
      { status: 400 },
    );
  }

  try {
    if (requestId) {
      const event = await client.getEvent(requestId);
      return NextResponse.json(event);
    }

    if (visitorId) {
      const history = await client.getVisits(visitorId, { limit: 10 });
      return NextResponse.json(history);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
