import { NextResponse } from "next/server";
import { getAccounts } from "@/lib/accounts";
import { addToBlacklist, getBlacklist, isBlacklisted, removeFromBlacklist } from "@/lib/blacklist";
import { getVisitors } from "@/lib/visitors";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    accounts: getAccounts(),
    visitors: getVisitors(),
    blacklist: getBlacklist(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { visitorId, reason } = body;

    if (!visitorId || typeof visitorId !== "string" || visitorId.trim() === "") {
      return NextResponse.json(
        { error: "visitorId jest wymagany" },
        { status: 400 },
      );
    }

    if (isBlacklisted(visitorId.trim())) {
      return NextResponse.json(
        { error: "Ten visitorId jest już na blackliście" },
        { status: 409 },
      );
    }

    addToBlacklist(visitorId.trim(), reason || "Ręcznie dodany przez admina");

    return NextResponse.json(
      { success: true, message: `visitorId ${visitorId} dodany do blacklisty` },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Nieprawidłowe dane żądania" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { visitorId } = body;

    if (!visitorId || typeof visitorId !== "string" || visitorId.trim() === "") {
      return NextResponse.json(
        { error: "visitorId jest wymagany" },
        { status: 400 },
      );
    }

    const removed = removeFromBlacklist(visitorId.trim());

    if (!removed) {
      return NextResponse.json(
        { error: "Ten visitorId nie jest na blackliście" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: true, message: `visitorId ${visitorId} usunięty z blacklisty` },
    );
  } catch {
    return NextResponse.json(
      { error: "Nieprawidłowe dane żądania" },
      { status: 400 },
    );
  }
}
