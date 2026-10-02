"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Engagement" },
  { href: "/ingest", label: "Ingest" },
  { href: "/ontology", label: "Ontology" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/query", label: "Ask data" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white grid place-items-center font-bold text-sm">
            H
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-slate-900 text-sm">
              Harborline Freight
            </div>
            <div className="text-xs text-slate-500">FDE onboarding accelerator</div>
          </div>
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
