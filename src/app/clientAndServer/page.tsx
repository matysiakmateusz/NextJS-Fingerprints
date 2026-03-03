"use client";

import { useVisitorData } from "@fingerprintjs/fingerprintjs-pro-react";
import { useState } from "react";

const ClientAndServerPage = () => {
  const { isLoading, error, data } = useVisitorData(
    { extendedResult: true, ignoreCache: true },
    { immediate: true },
  );

  const [serverData, setServerData] = useState<unknown>(null);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverDataLabel, setServerDataLabel] = useState<string | null>(null);

  const fetchServerEvent = async () => {
    if (!data?.requestId) return;
    setServerLoading(true);
    try {
      const res = await fetch(`/api/fingerprint?requestId=${data.requestId}`);
      const json = await res.json();
      setServerData(json);
      setServerDataLabel("Get Event (Server API)");
    } finally {
      setServerLoading(false);
    }
  };

  const fetchVisitorHistory = async () => {
    if (!data?.visitorId) return;
    setServerLoading(true);
    try {
      const res = await fetch(`/api/fingerprint?visitorId=${data.visitorId}`);
      const json = await res.json();
      setServerData(json);
      setServerDataLabel("Get Visitor History");
    } finally {
      setServerLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Klient – Identyfikacja w przeglądarce</h1>

      <h2 className="text-xl font-bold mb-2">Full visitor client data:</h2>

      <pre className="mb-4 p-4 bg-gray-100 rounded text-sm text-gray-800">
        {isLoading
          ? "Loading..."
          : error
            ? error.message
            : JSON.stringify(data, null, 2)}
      </pre>

      <h2 className="text-2xl font-bold mb-4">Serwer – Weryfikacja przez Server API</h2>

      <div className="mb-2 space-x-2">
        <button
          type="button"
          onClick={fetchServerEvent}
          disabled={!data?.requestId}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
        >
          Get Event (Server API)
        </button>
        <button
          type="button"
          onClick={fetchVisitorHistory}
          disabled={!data?.visitorId}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
        >
          Get Visitor History
        </button>
      </div>

      {serverData ? (
        <>
          <h3>
            Server API Data{serverDataLabel ? (
              <span className="ml-2 text-sm font-normal text-gray-500">– {serverDataLabel}</span>
            ) : null}:
          </h3>
          <pre className="mb-4 p-4 bg-gray-100 rounded text-sm text-gray-800">
            {serverLoading ? "Loading..." : JSON.stringify(serverData, null, 2)}
          </pre>
        </>
      ) : null}
    </div>
  );
};

export default ClientAndServerPage;
