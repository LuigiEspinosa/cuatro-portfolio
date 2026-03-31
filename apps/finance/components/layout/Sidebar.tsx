"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/accounts", label: "Cuentas" },
  { href: "/budgets", label: "Presupuestos" },
  { href: "/debts", label: "Deudas" },
  { href: "/investments", label: "Inversiones" },
  { href: "/cashflow", label: "Flujo de caja" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-52 shrink-0 flex-col border-r border-border bg-card px-3 py-4">
      {/* Logo */}
      <div className="mb-6 px-2">
        <p className="text-sm font-semibold text-violet-400">Cuatro Finance</p>
        <p className="text-xs text-muted-foreground">Finanzas Personales</p>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors",
              pathname.startsWith(item.href)
                ? "bg-violet-950 text-violet-300 font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Settings pinned to botton */}
      <Link
        href="/settings"
        className={cn(
          "rounded-md px-3 py-2 text-sm transition-colors",
          pathname === "/settings"
            ? "bg-violet-950 text-violet-300 font-medium"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        Configuración
      </Link>
    </aside>
  );
}
