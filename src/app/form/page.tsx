"use client";

import { useVisitorData } from "@fingerprintjs/fingerprintjs-pro-react";
import { type FormEvent, useState } from "react";

type FormStatus = "idle" | "loading" | "success" | "error";

interface AccountResponse {
  success?: boolean;
  message?: string;
  userId?: string;
  error?: string;
  details?: {
    visitorId?: string;
    requestId?: string;
    botResult?: string;
    confidence?: number;
    blockedAt?: string;
  };
}

const FormPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [response, setResponse] = useState<AccountResponse | null>(null);

  const { getData } = useVisitorData(
    { extendedResult: true, ignoreCache: true },
    { immediate: false },
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setResponse(null);

    try {
      // Krok 1: Pobierz fingerprint z Fingerprint API (~70 sygnałów przeglądarki)
      let visitorId = "unknown";
      let requestId = "unknown";

      try {
        const fpData = await getData();
        if (fpData?.visitorId && fpData?.requestId) {
          visitorId = fpData.visitorId;
          requestId = fpData.requestId;
          console.log(
            `[Form] visitorId: ${visitorId}, requestId: ${requestId}, confidence: ${fpData.confidence?.score}`,
          );
        }
      } catch (fpError) {
        console.warn("[Form] Fingerprint SDK error:", fpError);
        // Kontynuuj z placeholder — serwer odrzuci bez E2E headera
      }

      // Krok 2: Wyślij dane formularza + fingerprint do proxy
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      const res = await fetch("/api/fetch-proxy", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name,
          email,
          password,
          visitorId,
          requestId,
        }),
      });

      const data: AccountResponse = await res.json();

      if (!res.ok) {
        setStatus("error");
        setResponse(data);
        return;
      }

      setStatus("success");
      setResponse(data);
      setName("");
      setEmail("");
      setPassword("");
    } catch {
      setStatus("error");
      setResponse({ error: "Wystąpił nieoczekiwany błąd" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Załóż konto</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Imię
            </label>
            <input
              id="name"
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={status === "loading"}
              placeholder="Jan"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 bg-white text-gray-900"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "loading"}
              placeholder="jan@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 bg-white text-gray-900"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1"
            >
              Hasło
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={status === "loading"}
              placeholder="Min. 6 znaków"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 bg-white text-gray-900"
            />
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === "loading" ? "Wysyłanie..." : "Załóż konto"}
          </button>
        </form>

        {/* Status messages */}
        {status === "success" && response && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-800 font-medium">
              ✅ {response.message}
            </p>
            {response.userId && (
              <p className="text-green-600 text-sm mt-1">
                ID użytkownika: {response.userId}
              </p>
            )}
          </div>
        )}

        {status === "error" && response && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 font-medium">
              ❌ {response.error || "Wystąpił błąd"}
            </p>
            {response.details && (
              <div className="mt-3 space-y-1 text-sm text-red-700">
                <p><span className="font-medium">Visitor ID:</span> <span className="font-mono">{response.details.visitorId}</span></p>
                <p><span className="font-medium">Request ID:</span> <span className="font-mono">{response.details.requestId}</span></p>
                <p><span className="font-medium">Bot result:</span> <span className="font-mono">{response.details.botResult}</span></p>
                <p><span className="font-medium">Confidence:</span> <span className="font-mono">{response.details.confidence?.toFixed(4)}</span></p>
                <p><span className="font-medium">Zablokowano:</span> {response.details.blockedAt && new Date(response.details.blockedAt).toLocaleString("pl-PL")}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FormPage;
