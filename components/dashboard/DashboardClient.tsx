"use client";

import { useRouter } from "next/navigation";
import { JWTPayload } from "@/lib/auth";

const C = {
    onyx: "#0b0c0c",
    jetBlack: "#2a2e34",
    platinum: "#e9eaec",
    brightGold: "#fbe134",
    saffron: "#e4b61a",
} as const;

interface DashboardClientProps {
    user: JWTPayload;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
    label,
    value,
    icon,
    sub,
}: {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    sub?: string;
}) {
    return (
        <div
            className="rounded-xl p-5 flex items-start gap-4 border border-white/5 shadow-md"
            style={{ backgroundColor: `${C.jetBlack}cc` }}
        >
            <div
                className="rounded-lg p-3 shrink-0"
                style={{ backgroundColor: `${C.brightGold}22`, color: C.brightGold }}
            >
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-xs font-medium tracking-wide uppercase" style={{ color: `${C.platinum}66` }}>
                    {label}
                </p>
                <p className="text-3xl font-bold mt-0.5" style={{ color: C.platinum }}>
                    {value}
                </p>
                {sub && (
                    <p className="text-xs mt-1" style={{ color: `${C.platinum}55` }}>
                        {sub}
                    </p>
                )}
            </div>
        </div>
    );
}

// ─── Dashboard principal ──────────────────────────────────────────────────────
export default function DashboardClient({ user }: DashboardClientProps) {
    const router = useRouter();

    async function handleLogout() {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
    }

    const initials = `${user.nombre.charAt(0)}`.toUpperCase();

    return (
        <div
            className="min-h-screen flex flex-col"
            style={{ background: `linear-gradient(135deg, ${C.onyx} 0%, ${C.jetBlack} 100%)` }}
        >
            {/* ── Topbar ── */}
            <header
                className="flex items-center justify-between px-6 py-4 border-b border-white/5 sticky top-0 z-10 backdrop-blur-sm"
                style={{ backgroundColor: `${C.onyx}cc` }}
            >
                <div className="flex items-center gap-3">
                    <span className="text-2xl font-extrabold tracking-tight" style={{ color: C.brightGold }}>
                        Taximast
                    </span>
                    <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full border"
                        style={{ color: C.saffron, borderColor: `${C.saffron}55`, backgroundColor: `${C.saffron}15` }}
                    >
                        Dashboard
                    </span>
                </div>

                {/* Usuario + logout */}
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-semibold leading-none" style={{ color: C.platinum }}>
                            {user.nombre}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: `${C.platinum}66` }}>
                            {user.rol === "admin" ? "Administrador" : "Operador"}
                        </p>
                    </div>
                    {/* Avatar inicial */}
                    <div
                        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                        style={{ backgroundColor: C.brightGold, color: C.onyx }}
                    >
                        {initials}
                    </div>
                    {/* Logout */}
                    <button
                        onClick={handleLogout}
                        className="text-xs px-3 py-1.5 rounded-lg border transition-all"
                        style={{
                            color: `${C.platinum}88`,
                            borderColor: `${C.platinum}22`,
                            backgroundColor: "transparent",
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.borderColor = `${C.platinum}55`;
                            (e.currentTarget as HTMLButtonElement).style.color = C.platinum;
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.borderColor = `${C.platinum}22`;
                            (e.currentTarget as HTMLButtonElement).style.color = `${C.platinum}88`;
                        }}
                    >
                        Cerrar sesión
                    </button>
                </div>
            </header>

            {/* ── Contenido ── */}
            <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
                {/* Saludo */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold" style={{ color: C.platinum }}>
                        Bienvenido, {user.nombre} 👋
                    </h1>
                    <p className="text-sm mt-1" style={{ color: `${C.platinum}66` }}>
                        Resumen general del sistema
                    </p>
                </div>

                {/* Tarjetas de estadísticas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <StatCard
                        label="Chats activos"
                        value="—"
                        sub="En tiempo real"
                        icon={<ChatIcon />}
                    />
                    <StatCard
                        label="Mensajes hoy"
                        value="—"
                        sub="Últimas 24 h"
                        icon={<MessageIcon />}
                    />
                    <StatCard
                        label="Operadores"
                        value="—"
                        sub="En línea ahora"
                        icon={<UserIcon />}
                    />
                    <StatCard
                        label="Líneas activas"
                        value="—"
                        sub="Integradas"
                        icon={<LineIcon />}
                    />
                </div>

                {/* Panel de accesos rápidos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Placeholder chats */}
                    <div
                        className="rounded-xl p-6 border border-white/5 shadow-md min-h-48 flex flex-col gap-3"
                        style={{ backgroundColor: `${C.jetBlack}cc` }}
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="font-semibold text-sm" style={{ color: C.platinum }}>
                                Chats recientes
                            </h2>
                            <span className="text-xs" style={{ color: `${C.platinum}44` }}>Próximamente</span>
                        </div>
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-sm text-center" style={{ color: `${C.platinum}33` }}>
                                Los chats aparecerán aquí
                            </p>
                        </div>
                    </div>

                    {/* Panel de acciones rápidas */}
                    <div
                        className="rounded-xl p-6 border border-white/5 shadow-md flex flex-col gap-3"
                        style={{ backgroundColor: `${C.jetBlack}cc` }}
                    >
                        <h2 className="font-semibold text-sm" style={{ color: C.platinum }}>
                            Acciones rápidas
                        </h2>
                        <div className="flex flex-col gap-2 mt-1">
                            {[
                                { label: "Ir a chats", href: "/chat", icon: <ChatIcon className="w-4 h-4" /> },
                                ...(user.rol === "admin"
                                    ? [
                                        { label: "Gestionar operadores", href: "/admin/operadores", icon: <UserIcon className="w-4 h-4" /> },
                                        { label: "Gestionar líneas", href: "/admin/lineas", icon: <LineIcon className="w-4 h-4" /> },
                                    ]
                                    : []),
                            ].map((item) => (
                                <button
                                    key={item.href}
                                    onClick={() => router.push(item.href)}
                                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-left transition-all border border-transparent"
                                    style={{ color: C.platinum, backgroundColor: `${C.onyx}80` }}
                                    onMouseEnter={(e) => {
                                        (e.currentTarget as HTMLButtonElement).style.borderColor = `${C.brightGold}44`;
                                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${C.onyx}cc`;
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
                                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${C.onyx}80`;
                                    }}
                                >
                                    <span style={{ color: C.brightGold }}>{item.icon}</span>
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

/* ─── Iconos SVG ─── */
function ChatIcon({ className = "w-5 h-5" }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
    );
}
function MessageIcon({ className = "w-5 h-5" }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
    );
}
function UserIcon({ className = "w-5 h-5" }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
    );
}
function LineIcon({ className = "w-5 h-5" }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
    );
}
