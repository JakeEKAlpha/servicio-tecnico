"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoAlpha from "@/components/LogoAlpha";
import LogoBaja from "@/components/LogoBaja";
import MenuUsuario from "@/components/MenuUsuario";

const NAV = [
  { href: "/tablero", label: "Tablero", icon: "M4 5h16M4 12h16M4 19h10" },
  {
    href: "/tablero-dias",
    label: "Agenda del día",
    icon: "M5 4h14v16H5zM5 9h14M9 4v16",
  },
  {
    href: "/almacen",
    label: "Almacén",
    icon: "M3 9l9-6 9 6v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  },
] as const;

const CONFIG_ITEM = {
  href: "/configuracion",
  label: "Configuración",
  icon: "M10.3 3.2a1 1 0 0 1 3.4 0l.2 1.3a7 7 0 0 1 1.7 1l1.2-.5a1 1 0 0 1 1.3.4l1 1.7a1 1 0 0 1-.3 1.3l-1 .8a7 7 0 0 1 0 2l1 .8a1 1 0 0 1 .3 1.3l-1 1.7a1 1 0 0 1-1.3.4l-1.2-.5a7 7 0 0 1-1.7 1l-.2 1.3a1 1 0 0 1-3.4 0l-.2-1.3a7 7 0 0 1-1.7-1l-1.2.5a1 1 0 0 1-1.3-.4l-1-1.7a1 1 0 0 1 .3-1.3l1-.8a7 7 0 0 1 0-2l-1-.8a1 1 0 0 1-.3-1.3l1-1.7a1 1 0 0 1 1.3-.4l1.2.5a7 7 0 0 1 1.7-1zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
} as const;

function Icono({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
    >
      <path d={d} />
    </svg>
  );
}

type NavItem = { href: string; label: string; icon: string };

function ListaNav({
  items,
  path,
  compacto,
  onNavigate,
}: {
  items: NavItem[];
  path: string;
  compacto: boolean;
  onNavigate: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const activo = path === item.href || path.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            title={compacto ? item.label : undefined}
            onClick={onNavigate}
            className={
              "flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors " +
              (compacto ? "justify-center px-2" : "px-3") +
              " " +
              (activo
                ? "bg-white text-brand shadow-sm"
                : "text-white/80 hover:bg-white/10 hover:text-white")
            }
          >
            <Icono d={item.icon} />
            {!compacto && item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AppShell({
  children,
  empresaClave,
  empresaNombre,
  empresaLema,
  esGerencia,
  zonaNombre,
  userNombre,
  userRol,
  cerrarSesion,
}: {
  children: React.ReactNode;
  empresaClave: "alpha" | "baja";
  empresaNombre: string;
  empresaLema: string;
  esGerencia: boolean;
  zonaNombre: string | null;
  userNombre: string;
  userRol: string;
  cerrarSesion: () => void | Promise<void>;
}) {
  const path = usePathname();
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [colapsado, setColapsado] = useState(false);

  useEffect(() => {
    let v: string | null = null;
    try {
      v = localStorage.getItem("sidebar");
    } catch {
      /* noop */
    }
    if (v === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setColapsado(true);
    }
  }, []);

  function alternarColapso() {
    setColapsado((c) => {
      try {
        localStorage.setItem("sidebar", c ? "0" : "1");
      } catch {
        /* noop */
      }
      return !c;
    });
  }

  const items = [
    ...NAV,
    ...(esGerencia
      ? [
          {
            href: "/gerencia",
            label: "Gerencia",
            icon: "M12 3l8 4v6c0 5-3.5 7.5-8 8-4.5-.5-8-3-8-8V7z",
          },
        ]
      : []),
    CONFIG_ITEM,
  ];

  const Logo = empresaClave === "baja" ? LogoBaja : LogoAlpha;
  const cerrarDrawer = () => setDrawerAbierto(false);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar escritorio */}
      <aside
        className={
          "banda-marca hidden shrink-0 flex-col transition-[width] duration-200 lg:flex " +
          (colapsado ? "w-16" : "w-56")
        }
      >
        <Link
          href="/tablero"
          className={
            "flex items-center gap-2.5 border-b border-white/15 py-4 " +
            (colapsado ? "justify-center px-2" : "px-4")
          }
        >
          <Logo variante="blanco" className="h-7 w-auto shrink-0" />
          {!colapsado && (
            <span className="text-sm font-bold tracking-wide text-white/90">
              Servicio Técnico
            </span>
          )}
        </Link>

        <ListaNav
          items={items}
          path={path}
          compacto={colapsado}
          onNavigate={cerrarDrawer}
        />

        <button
          type="button"
          onClick={alternarColapso}
          className="mt-auto m-3 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white"
          title={colapsado ? "Expandir menú" : "Contraer menú"}
        >
          <svg
            viewBox="0 0 24 24"
            className={"h-4 w-4 " + (colapsado ? "rotate-180" : "")}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M13 5l-7 7 7 7M19 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {!colapsado && "Contraer"}
        </button>
      </aside>

      {/* Drawer móvil */}
      {drawerAbierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerAbierto(false)}
          />
          <aside className="banda-marca absolute left-0 top-0 flex h-full w-64 flex-col">
            <div className="flex items-center gap-2.5 border-b border-white/15 px-4 py-4">
              <Logo variante="blanco" className="h-7 w-auto" />
              <span className="text-sm font-bold tracking-wide text-white/90">
                Servicio Técnico
              </span>
            </div>
            <ListaNav
              items={items}
              path={path}
              compacto={false}
              onNavigate={cerrarDrawer}
            />
          </aside>
        </div>
      )}

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-default bg-surface/95 px-3 py-2.5 backdrop-blur sm:px-5">
          <button
            type="button"
            onClick={() => setDrawerAbierto(true)}
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 lg:hidden"
            aria-label="Menú"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          <Link href="/tablero" className="lg:hidden">
            <Logo variante="color" className="h-6 w-auto" />
          </Link>

          <div className="ml-auto flex items-center gap-2">
            {zonaNombre && (
              <span className="hidden rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted sm:inline">
                {zonaNombre}
              </span>
            )}
            <MenuUsuario
              nombre={userNombre}
              rol={userRol}
              empresa={empresaNombre}
              cerrarSesion={cerrarSesion}
            />
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-border-default px-4 py-4 text-center text-xs text-muted">
          {empresaNombre} · {empresaLema} · © {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}
