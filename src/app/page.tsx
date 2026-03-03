import Link from "next/link";

const menuItems = [
  {
    href: "/example1",
    title: "Basic React Integration",
    description: "Podstawowa integracja Fingerprint z React po stronie klienta.",
    icon: "⚛️",
  },
  {
    href: "/example2",
    title: "Server API",
    description: "Weryfikacja odcisków palców po stronie serwera.",
    icon: "🖥️",
  },
  {
    href: "/form",
    title: "Formularz",
    description: "Formularz z Fingerprint Proxy do ochrony transakcji.",
    icon: "📝",
  },
  {
    href: "/admin",
    title: "Admin Dashboard",
    description: "Panel administracyjny do zarządzania odciskami palców.",
    icon: "🔒",
  },
];

const HomePage = () => {
  return (
    <div className="py-12">
      <header className="mb-12 text-center">
        <h1 className="mb-3 text-4xl font-bold tracking-tight">
          Fingerprint <span className="text-blue-500">Demo</span>
        </h1>
        <p className="mx-auto max-w-md text-lg text-zinc-500 dark:text-zinc-400">
          Przykłady integracji FingerprintJS Pro z Next.js
        </p>
      </header>

      <nav className="grid gap-4 sm:grid-cols-2">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-xl border border-zinc-200 p-6 transition-all hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 dark:border-zinc-800 dark:hover:border-blue-500/40"
          >
            <span className="mb-3 block text-3xl">{item.icon}</span>
            <h2 className="mb-1 text-lg font-semibold group-hover:text-blue-500 transition-colors">
              {item.title}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {item.description}
            </p>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default HomePage;
