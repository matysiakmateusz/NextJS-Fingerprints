"use client";

import {
  FingerprintJSPro,
  FpjsProvider,
} from "@fingerprintjs/fingerprintjs-pro-react";

export function FingerprintProvider(props: { children: React.ReactNode }) {
  const { children } = props;

  return (
    <FpjsProvider
      loadOptions={{
        apiKey: process.env.NEXT_PUBLIC_FINGERPRINT_API_KEY!,
        region: "eu",
        endpoint: [FingerprintJSPro.defaultEndpoint],
        scriptUrlPattern: [FingerprintJSPro.defaultScriptUrlPattern],
      }}
    >
      {children}
    </FpjsProvider>
  );
}
