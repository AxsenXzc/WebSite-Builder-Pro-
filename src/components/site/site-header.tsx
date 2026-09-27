"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UserMenu } from "@/components/auth/user-menu";

const LINKS = [
  { href: "#come-funziona", label: "Come funziona" },
  { href: "#stili", label: "Stili" },
  { href: "#qualita", label: "Qualità" },
  { href: "#export", label: "Export" },
];

/** Barra di vetro della vetrina: si compatta allo scorrimento. */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`glass safe-top sticky top-0 z-40 transition-shadow ${scrolled ? "shadow-[0_18px_50px_-40px_rgba(0,0,0,0.9)]" : ""}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-[0.6rem] border border-accent-500/40 bg-accent-600/15 font-mono text-sm text-accent-400">
            A
          </span>
          <span className="grid leading-none">
            <span className="text-sm font-semibold tracking-tight">Atelier</span>
            <span className="text-[10px] text-ink-600">website builder AI</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="rounded-tool px-3 py-1.5 text-xs text-ink-500 hover:bg-surface-850 hover:text-ink-100">
              {link.label}
            </a>
          ))}
        </nav>

        <UserMenu compact />
      </div>
    </header>
  );
}
