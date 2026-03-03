import { NextResponse } from "next/server";
import { addAccount } from "@/lib/accounts";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, visitorId } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Imię i email są wymagane" },
        { status: 400 },
      );
    }

    const userId = crypto.randomUUID();

    // Zapisz konto w in-memory store
    addAccount({
      userId,
      name,
      email,
      visitorId,
      createdAt: new Date().toISOString(),
    });

    console.log(
      `[Accounts] Tworzenie konta dla: ${name} (${email}), visitorId: ${visitorId}`,
    );

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
      { error: "Nieprawidłowe dane żądania" },
      { status: 400 },
    );
  }
}
