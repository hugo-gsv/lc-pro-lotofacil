"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Sparkles, Filter, Check, Archive, Menu } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Início", icon: Home },
  { href: "/gerador", label: "Gerador", icon: Sparkles },
  { href: "/filtrar", label: "Filtrar Jogo", icon: Filter },
  { href: "/conferidor", label: "Conferidor", icon: Check },
  { href: "/historico", label: "Histórico", icon: Archive },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md"
        onClick={() => setOpen(!open)}
        aria-label="Menu"
      >
        <Menu size={20} />
      </button>

      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-60 z-40 transition-transform",
          "md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          background:
            "radial-gradient(circle at 0% 0%, rgba(20,198,228,.15) 0%, transparent 40%), linear-gradient(180deg, #0A1F2A 0%, #0F2D3D 50%, #143F52 100%)",
        }}
      >
        <div className="px-5 py-7 border-b border-white/5">
          <div className="text-2xl">🎯</div>
          <div className="mt-2 font-extrabold text-white text-lg leading-tight tracking-tight">
            LC Pro
          </div>
          <div className="text-[10px] uppercase tracking-[2px] text-white/60 font-semibold mt-0.5">
            Lotofácil
          </div>
        </div>

        <nav className="p-3 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-semibold transition-all",
                  active
                    ? "bg-white/15 text-white shadow-lg shadow-cyan-500/10"
                    : "text-white/70 hover:bg-white/8 hover:text-white"
                )}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-30"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
