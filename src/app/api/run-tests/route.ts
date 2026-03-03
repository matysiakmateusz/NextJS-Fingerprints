import { type ChildProcess, spawn } from "node:child_process";
import { NextResponse } from "next/server";

const ALLOWED_TESTS = {
	e2e: { label: "Playwright E2E" },
	"bot-test": { label: "Bot Test" },
} as const;

type TestType = keyof typeof ALLOWED_TESTS;

const LOCAL_COMMANDS: Record<TestType, { command: string; args: string[] }> = {
	e2e: { command: "pnpm", args: ["e2e"] },
	"bot-test": { command: "pnpm", args: ["bot-test"] },
};

// Track running processes (local only)
const running = new Map<string, ChildProcess>();

// ─── GitHub API helpers ─────────────────────────────────────────────

function getGitHubConfig() {
	const token = process.env.GITHUB_TOKEN;
	const repo =
		process.env.GITHUB_REPOSITORY ||
		(process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
			? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
			: null);
	const ref = process.env.VERCEL_GIT_COMMIT_REF || "main";
	return { token, repo, ref };
}

async function githubFetch(path: string, options?: RequestInit) {
	const { token, repo } = getGitHubConfig();
	return fetch(`https://api.github.com/repos/${repo}${path}`, {
		redirect: "follow",
		...options,
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
			...options?.headers,
		},
	});
}

// ─── POST /api/run-tests ───────────────────────────────────────────

export async function POST(request: Request) {
	const body = await request.json();
	const type = body.type as TestType;

	if (!type || !ALLOWED_TESTS[type]) {
		return NextResponse.json(
			{
				error: `Nieprawidłowy typ testu. Dozwolone: ${Object.keys(ALLOWED_TESTS).join(", ")}`,
			},
			{ status: 400 },
		);
	}

	// ─── Vercel: trigger GitHub Actions workflow ───
	if (process.env.VERCEL) {
		const { token, repo, ref } = getGitHubConfig();

		if (!token || !repo) {
			return NextResponse.json(
				{
					error:
						"Brak konfiguracji GitHub. Ustaw GITHUB_TOKEN (z uprawnieniem actions:write) oraz opcjonalnie GITHUB_REPOSITORY (owner/repo) w zmiennych środowiskowych Vercel.",
				},
				{ status: 500 },
			);
		}

		// Trigger workflow_dispatch
		const dispatchRes = await githubFetch(
			"/actions/workflows/run-tests.yml/dispatches",
			{
				method: "POST",
				body: JSON.stringify({ ref, inputs: { test_type: type } }),
			},
		);

		if (!dispatchRes.ok) {
			const text = await dispatchRes.text();
			return NextResponse.json(
				{ error: `Błąd GitHub API (${dispatchRes.status}): ${text}` },
				{ status: 502 },
			);
		}

		// Wait a moment then find the triggered run
		await new Promise((r) => setTimeout(r, 3000));

		const runsRes = await githubFetch(
			"/actions/workflows/run-tests.yml/runs?per_page=1&event=workflow_dispatch",
		);

		if (!runsRes.ok) {
			return NextResponse.json(
				{ error: "Nie udało się odnaleźć uruchomionego workflow" },
				{ status: 502 },
			);
		}

		const runsData = await runsRes.json();
		const run = runsData.workflow_runs?.[0];

		if (!run?.id) {
			return NextResponse.json(
				{
					error: "Workflow został wywołany, ale nie znaleziono run ID",
				},
				{ status: 502 },
			);
		}

		return NextResponse.json({
			runId: run.id,
			status: "triggered",
			htmlUrl: run.html_url,
		});
	}

	// ─── Local: spawn process & stream via SSE ───

	if (running.has(type)) {
		return NextResponse.json(
			{ error: `Test "${ALLOWED_TESTS[type].label}" już jest uruchomiony` },
			{ status: 409 },
		);
	}

	const config = LOCAL_COMMANDS[type];

	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		start(controller) {
			const proc = spawn(config.command, config.args, {
				cwd: process.cwd(),
				env: { ...process.env, FORCE_COLOR: "0" },
				shell: true,
				stdio: ["ignore", "pipe", "pipe"],
			});

			running.set(type, proc);

			const send = (data: string) => {
				try {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
					);
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
						encoder.encode(`data: ${JSON.stringify({ code })}\n\n`),
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
						encoder.encode(
							`data: ${JSON.stringify(`\n[BŁĄD] Nie udało się uruchomić procesu: ${err.message}\n`)}\n\n`,
						),
					);
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify({ code: 1 })}\n\n`),
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

// ─── GET /api/run-tests?runId=... (Vercel only — poll workflow status) ──

export async function GET(request: Request) {
	if (!process.env.VERCEL) {
		return NextResponse.json(
			{ error: "Endpoint dostępny tylko na Vercel (GitHub Actions polling)" },
			{ status: 404 },
		);
	}

	const { searchParams } = new URL(request.url);
	const runId = searchParams.get("runId");

	if (!runId) {
		return NextResponse.json(
			{ error: "Brak parametru runId" },
			{ status: 400 },
		);
	}

	const { token, repo } = getGitHubConfig();
	if (!token || !repo) {
		return NextResponse.json(
			{ error: "Brak konfiguracji GitHub" },
			{ status: 500 },
		);
	}

	// Get run status
	const runRes = await githubFetch(`/actions/runs/${runId}`);
	if (!runRes.ok) {
		return NextResponse.json(
			{ error: `Nie znaleziono run ${runId}` },
			{ status: 404 },
		);
	}

	const runData = await runRes.json();
	const status = runData.status as string;
	const conclusion = runData.conclusion as string | null;

	// If not completed yet, return just the status
	if (status !== "completed") {
		return NextResponse.json({ status, conclusion });
	}

	// Fetch logs for the first job
	let logs: string | null = null;
	try {
		const jobsRes = await githubFetch(`/actions/runs/${runId}/jobs`);
		if (jobsRes.ok) {
			const jobsData = await jobsRes.json();
			const job = jobsData.jobs?.[0];
			if (job) {
				const logsRes = await githubFetch(`/actions/jobs/${job.id}/logs`);
				if (logsRes.ok) {
					logs = await logsRes.text();
				}
			}
		}
	} catch {
		// logs not available — not critical
	}

	return NextResponse.json({ status, conclusion, logs });
}
