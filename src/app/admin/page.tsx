"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Account {
  userId: string;
  name: string;
  email: string;
  visitorId: string;
  createdAt: string;
}

interface VisitorEntry {
  visitorId: string;
  confidence: number;
  requestId: string;
  botResult: string | null;
  timestamp: string;
  blocked: boolean;
  reason: string | null;
}

interface BlacklistEntry {
  visitorId: string;
  reason: string;
  addedAt: string;
}

interface AdminData {
  accounts: Account[];
  visitors: VisitorEntry[];
  blacklist: BlacklistEntry[];
}

const AdminPage = () => {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "accounts" | "visitors" | "blacklist" | "tests"
  >("accounts");
  const [blacklistInput, setBlacklistInput] = useState("");
  const [blacklistReason, setBlacklistReason] = useState("");
  const [blacklistStatus, setBlacklistStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // --- Test runner state ---
  const [testRunning, setTestRunning] = useState<Record<string, boolean>>({});
  const [testOutput, setTestOutput] = useState<Record<string, string>>({});
  const [testExitCode, setTestExitCode] = useState<Record<string, number | null>>({});
  const outputEndRef = useRef<HTMLDivElement>(null);
  const pollTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Cleanup poll timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of Object.values(pollTimers.current)) {
        clearTimeout(timer);
      }
    };
  }, []);

  /** Colorize terminal output for the live preview */
  const colorizeOutput = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      const key = i;

      // Box-drawing / banner lines
      if (/^[╔╚╗╝║━]/.test(line)) {
        return <span key={key} className="text-cyan-400">{line}{"\n"}</span>;
      }

      // BLOCKED / error lines — red
      if (/BLOCKED|FAILED|ERROR|✘|✗|❌|HTTP [45]\d{2}|failed|Error:/.test(line)) {
        return <span key={key} className="text-red-400">{line}{"\n"}</span>;
      }

      // PASSED / success lines — green
      if (/PASSED|✓|✅|passed|success|1 passed/.test(line)) {
        return <span key={key} className="text-green-400">{line}{"\n"}</span>;
      }

      // Warning / summary headers — yellow
      if (/⚠️|PODSUMOWANIE|WARNING|powinien/.test(line)) {
        return <span key={key} className="text-yellow-400">{line}{"\n"}</span>;
      }

      // Section headers (━━━ WARIANT) — cyan
      if (/━━━/.test(line)) {
        return <span key={key} className="text-cyan-300">{line}{"\n"}</span>;
      }

      return <span key={key}>{line}{"\n"}</span>;
    });
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin");
      const json: AdminData = await res.json();
      setData(json);
    } catch (err) {
      console.error("Błąd pobierania danych admin:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddToBlacklist = async () => {
    if (!blacklistInput.trim()) return;
    setBlacklistStatus(null);

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId: blacklistInput.trim(),
          reason: blacklistReason.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setBlacklistStatus({ type: "error", message: json.error });
        return;
      }

      setBlacklistStatus({ type: "success", message: json.message });
      setBlacklistInput("");
      setBlacklistReason("");
      fetchData();
    } catch {
      setBlacklistStatus({ type: "error", message: "Wystąpił błąd" });
    }
  };

  const handleRemoveFromBlacklist = async (visitorId: string) => {
    try {
      const res = await fetch("/api/admin", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId }),
      });

      const json = await res.json();

      if (!res.ok) {
        setBlacklistStatus({ type: "error", message: json.error });
        return;
      }

      setBlacklistStatus({ type: "success", message: json.message });
      fetchData();
    } catch {
      setBlacklistStatus({ type: "error", message: "Wystąpił błąd" });
    }
  };

  const runTest = async (type: "e2e" | "bot-test") => {
    if (testRunning[type]) return;

    // Clear any previous poll timer for this type
    if (pollTimers.current[type]) {
      clearTimeout(pollTimers.current[type]);
      delete pollTimers.current[type];
    }

    setTestRunning((prev) => ({ ...prev, [type]: true }));
    setTestOutput((prev) => ({ ...prev, [type]: "" }));
    setTestExitCode((prev) => ({ ...prev, [type]: null }));

    try {
      const res = await fetch("/api/run-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });

      const contentType = res.headers.get("content-type") || "";

      // ─── Vercel: JSON response → GitHub Actions polling ───
      if (contentType.includes("application/json")) {
        const json = await res.json();

        if (!res.ok || json.error) {
          setTestOutput((prev) => ({ ...prev, [type]: json.error ?? "Błąd" }));
          setTestRunning((prev) => ({ ...prev, [type]: false }));
          return;
        }

        if (json.runId) {
          const ghUrl = json.htmlUrl ? `\n   ${json.htmlUrl}` : "";
          setTestOutput((prev) => ({
            ...prev,
            [type]: `⏳ Workflow GitHub Actions uruchomiony (Run #${json.runId})${ghUrl}\n   Oczekiwanie na wyniki...\n`,
          }));

          const statusLabels: Record<string, string> = {
            queued: "W kolejce",
            in_progress: "W trakcie wykonywania...",
            waiting: "Oczekiwanie...",
          };

          const poll = async () => {
            try {
              const pollRes = await fetch(`/api/run-tests?runId=${json.runId}`);
              const pollJson = await pollRes.json();

              if (pollJson.status === "completed") {
                delete pollTimers.current[type];
                const logs = pollJson.logs || "(brak logów)";
                setTestOutput((prev) => ({ ...prev, [type]: logs }));
                setTestExitCode((prev) => ({
                  ...prev,
                  [type]: pollJson.conclusion === "success" ? 0 : 1,
                }));
                setTestRunning((prev) => ({ ...prev, [type]: false }));
                return;
              }

              setTestOutput((prev) => ({
                ...prev,
                [type]: `⏳ Workflow GitHub Actions (Run #${json.runId})${ghUrl}\n   Status: ${statusLabels[pollJson.status] || pollJson.status}\n`,
              }));
              pollTimers.current[type] = setTimeout(poll, 5000);
            } catch {
              pollTimers.current[type] = setTimeout(poll, 5000);
            }
          };

          pollTimers.current[type] = setTimeout(poll, 5000);
          return;
        }

        setTestRunning((prev) => ({ ...prev, [type]: false }));
        return;
      }

      // ─── Local: SSE stream ───
      if (!res.body) {
        setTestOutput((prev) => ({ ...prev, [type]: "Błąd: brak response body" }));
        setTestRunning((prev) => ({ ...prev, [type]: false }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          if (line.startsWith("data: ")) {
            const payload = line.slice(6);
            try {
              const parsed = JSON.parse(payload);
              if (typeof parsed === "string") {
                setTestOutput((prev) => ({ ...prev, [type]: (prev[type] ?? "") + parsed }));
              } else if (parsed.code !== undefined) {
                setTestExitCode((prev) => ({ ...prev, [type]: parsed.code }));
              }
            } catch {
              // ignore malformed lines
            }
          }
        }
      }
      setTestRunning((prev) => ({ ...prev, [type]: false }));
    } catch {
      setTestOutput((prev) => ({ ...prev, [type]: (prev[type] ?? "") + "\n[Błąd połączenia]\n" }));
      setTestRunning((prev) => ({ ...prev, [type]: false }));
    }
  };

  const tabs = [
    { key: "accounts" as const, label: "Konta", count: data?.accounts.length ?? 0 },
    { key: "visitors" as const, label: "Wizyty (visitorId)", count: data?.visitors.length ?? 0 },
    { key: "blacklist" as const, label: "Blacklista", count: data?.blacklist.length ?? 0 },
    { key: "tests" as const, label: "Testy", count: null },
  ];

  return (
    <div className="min-h-screen max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50 transition-colors text-sm"
        >
          {loading ? "Odświeżanie..." : "Odśwież"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300"
            }`}
          >
            {tab.label}
            {tab.count !== null && (
              <span className="ml-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <p className="text-gray-500">Ładowanie...</p>
      ) : !data ? (
        <p className="text-red-500">Nie udało się pobrać danych</p>
      ) : (
        <>
          {/* Accounts */}
          {activeTab === "accounts" && (
            <div className="overflow-x-auto">
              {data.accounts.length === 0 ? (
                <p className="text-gray-500 py-8 text-center">
                  Brak utworzonych kont
                </p>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">User ID</th>
                      <th className="px-4 py-3">Imię</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Visitor ID</th>
                      <th className="px-4 py-3">Data utworzenia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {data.accounts.map((acc) => (
                      <tr key={acc.userId} className="hover:bg-gray-100 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 font-mono text-xs break-all">
                          {acc.userId}
                        </td>
                        <td className="px-4 py-3">{acc.name}</td>
                        <td className="px-4 py-3">{acc.email}</td>
                        <td className="px-4 py-3 font-mono text-xs break-all">
                          {acc.visitorId}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                          {new Date(acc.createdAt).toLocaleString("pl-PL")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Visitors */}
          {activeTab === "visitors" && (
            <div className="overflow-x-auto">
              {data.visitors.length === 0 ? (
                <p className="text-gray-500 py-8 text-center">
                  Brak zarejestrowanych wizyt
                </p>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Visitor ID</th>
                      <th className="px-4 py-3">Confidence</th>
                      <th className="px-4 py-3">Bot Result</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Powód</th>
                      <th className="px-4 py-3">Czas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {data.visitors.map((v) => (
                      <tr
                        key={`${v.requestId}-${v.timestamp}`}
                        className={`hover:bg-gray-100 dark:hover:bg-gray-800 ${v.blocked ? "bg-red-50 dark:bg-red-950" : ""}`}
                      >
                        <td className="px-4 py-3 font-mono text-xs break-all">
                          {v.visitorId}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-medium ${
                              v.confidence >= 0.9
                                ? "text-green-600"
                                : v.confidence >= 0.5
                                  ? "text-yellow-600"
                                  : "text-red-600"
                            }`}
                          >
                            {v.confidence.toFixed(3)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {v.botResult ? (
                            <span className="text-red-600 font-medium">
                              {v.botResult}
                            </span>
                          ) : (
                            <span className="text-green-600">notDetected</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {v.blocked ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Zablokowany
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Przepuszczony
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                          {v.reason ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                          {new Date(v.timestamp).toLocaleString("pl-PL")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Blacklist */}
          {activeTab === "blacklist" && (
            <div>
              {/* Add to blacklist form */}
              <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="text-sm font-medium mb-3">Dodaj do blacklisty</h3>
                <div className="flex gap-2 flex-wrap">
                  <input
                    type="text"
                    value={blacklistInput}
                    onChange={(e) => setBlacklistInput(e.target.value)}
                    placeholder="visitorId"
                    className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={blacklistReason}
                    onChange={(e) => setBlacklistReason(e.target.value)}
                    placeholder="Powód (opcjonalny)"
                    className="flex-1 min-w-[150px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddToBlacklist}
                    disabled={!blacklistInput.trim()}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  >
                    Zablokuj
                  </button>
                </div>
                {blacklistStatus && (
                  <p
                    className={`mt-2 text-sm ${
                      blacklistStatus.type === "success"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {blacklistStatus.message}
                  </p>
                )}
              </div>

              <div className="overflow-x-auto">
              {data.blacklist.length === 0 ? (
                <p className="text-gray-500 py-8 text-center">
                  Blacklista jest pusta
                </p>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Visitor ID</th>
                      <th className="px-4 py-3">Powód</th>
                      <th className="px-4 py-3">Data dodania</th>
                      <th className="px-4 py-3">Akcja</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {data.blacklist.map((b) => (
                      <tr
                        key={b.visitorId}
                        className="hover:bg-gray-100 dark:hover:bg-gray-800 bg-red-50 dark:bg-red-950"
                      >
                        <td className="px-4 py-3 font-mono text-xs">
                          {b.visitorId}
                        </td>
                        <td className="px-4 py-3 text-red-700 dark:text-red-400 font-medium">
                          {b.reason}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                          {new Date(b.addedAt).toLocaleString("pl-PL")}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleRemoveFromBlacklist(b.visitorId)}
                            className="px-3 py-1 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                          >
                            Usuń
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              </div>
            </div>
          )}

          {/* Tests */}
          {activeTab === "tests" && (
            <div className="space-y-6">
              {([
                { type: "e2e" as const, label: "Playwright E2E", description: "Pełny flow rejestracji, admin dashboard i blacklisty" },
                { type: "bot-test" as const, label: "Bot Test", description: "Raw HTTP, Puppeteer headless i stealth — 3 warianty ataków" },
              ]).map((t) => (
                <div key={t.type} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800">
                    <div>
                      <h3 className="font-medium">{t.label}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => runTest(t.type)}
                      disabled={testRunning[t.type]}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-2"
                    >
                      {testRunning[t.type] ? (
                        <>
                          <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Uruchomiono...
                        </>
                      ) : (
                        "Uruchom"
                      )}
                    </button>
                  </div>

                  {(testOutput[t.type] || testExitCode[t.type] !== undefined) && (
                    <div className="relative">
                      <pre className="p-4 bg-gray-900 text-gray-100 text-xs font-mono whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed">
                        {testOutput[t.type] ? colorizeOutput(testOutput[t.type]) : ""}
                        <div ref={outputEndRef} />
                      </pre>
                      {testExitCode[t.type] !== null && testExitCode[t.type] !== undefined && (
                        <div className={`px-4 py-2 text-xs font-medium ${testExitCode[t.type] === 0 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}`}>
                          Zakończono z kodem: {testExitCode[t.type]}
                          {testExitCode[t.type] === 0 ? " ✓" : " ✗"}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminPage;
