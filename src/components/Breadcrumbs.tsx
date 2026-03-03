"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const labels: Record<string, string> = {
  clientAndServer: "Klient i Serwer",
  form: "Formularz",
  admin: "Admin",
};

export const Breadcrumbs = () => {
  const pathname = usePathname();

  if (pathname === "/") return null;

  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav aria-label="Breadcrumbs" className="mb-6 text-sm text-foreground/50">
      <ol className="flex items-center gap-1.5">
        <li>
          <Link href="/" className="transition-colors hover:text-foreground">
            Strona główna
          </Link>
        </li>
        {segments.map((segment, i) => {
          const href = `/${segments.slice(0, i + 1).join("/")}`;
          const isLast = i === segments.length - 1;
          const label = labels[segment] ?? segment;

          return (
            <li key={href} className="flex items-center gap-1.5">
              <span className="text-foreground/25">/</span>
              {isLast ? (
                <span className="text-foreground/80 font-medium">{label}</span>
              ) : (
                <Link
                  href={href}
                  className="transition-colors hover:text-foreground"
                >
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
