import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FingerprintProvider } from "@/components/FingerprintProvider";
import { Breadcrumbs } from "@/components/Breadcrumbs";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Next.js + FingerprintJS Demo",
  description: "Przykładowa aplikacja Next.js demonstrująca integrację z FingerprintJS Pro Server API, w tym wykrywanie botów i testy E2E.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased p-4`}
      >
        <FingerprintProvider>
          <div className="mx-auto w-full max-w-4xl">
            <Breadcrumbs />
            {children}
          </div>
        </FingerprintProvider>
      </body>
    </html>
  );
}
