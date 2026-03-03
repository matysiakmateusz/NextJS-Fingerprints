import { type ChildProcess, spawn } from "node:child_process";
import { NextResponse } from "next/server";

const ALLOWED_TESTS = {
  e2e: { command: "pnpm", args: ["e2e"], label: "Playwright E2E" },
  "bot-test": { command: "pnpm", args: ["bot-test"], label: "Bot Test" },
} as const;

type TestType = keyof typeof ALLOWED_TESTS;

// Track running processes so we don't launch duplicates
const running = new Map<string, ChildProcess>();

export async function POST(request: Request) {
  const body = await request.json();
  const type = body.type as TestType;

  if (!type || !ALLOWED_TESTS[type]) {
    return NextResponse.json(
      { error: `Nieprawidłowy typ testu. Dozwolone: ${Object.keys(ALLOWED_TESTS).join(", ")}` },
      { status: 400 },
    );
  }

  if (running.has(type)) {
    return NextResponse.json(
      { error: `Test "${ALLOWED_TESTS[type].label}" już jest uruchomiony` },
      { status: 409 },
    );
  }

  const config = ALLOWED_TESTS[type];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const proc = spawn(config.command, config.args, {
        cwd: process.cwd(),
        env: { ...process.env, FORCE_COLOR: "0" },
        stdio: ["ignore", "pipe", "pipe"],
      });

      running.set(type, proc);

      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // stream closed
        }
      };

      proc.stdout?.on("data", (chunk: Buffer) => send(chunk.toString()));
      proc.stderr?.on("data", (chunk: Buffer) => send(chunk.toString()));

      proc.on("close", (code) => {
        running.delete(type);
        try {
          controller.enqueue(
            encoder.encode(`event: done\ndata: ${JSON.stringify({ code })}\n\n`),
          );
          controller.close();
        } catch {
          // stream already closed
        }
      });

      proc.on("error", (err) => {
        running.delete(type);
        try {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`),
          );
          controller.close();
        } catch {
          // stream already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
