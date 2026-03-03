"use client";

import { useVisitorData } from "@fingerprintjs/fingerprintjs-pro-react";

const Example1Page = () => {
  const { isLoading, error, data, getData } = useVisitorData(
    { extendedResult: true, ignoreCache: true },
    { immediate: true },
  );

  const reloadData = () => {
    getData({});
    console.log("Data reloaded");
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Klient – Identyfikacja w przeglądarce</h1>

      <div>
        <div>
          <button
            onClick={reloadData}
            type="button"
            className="px-4 py-2 bg-blue-500 text-white rounded mb-4"
          >
            Reload data
          </button>
        </div>
        <p>
          VisitorId: <span>{isLoading ? "Loading..." : data?.visitorId}</span>
        </p>
        <p>Full visitor data:</p>
        <pre className="mb-4 p-4 bg-gray-100 rounded text-sm text-gray-800">
          {isLoading
            ? "Loading..."
            : error
              ? error.message
              : JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default Example1Page;
