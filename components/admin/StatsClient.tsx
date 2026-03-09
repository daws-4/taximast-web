"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { JWTPayload } from "@/lib/auth";

const C = {
    onyx: "#0b0c0c",
    jetBlack: "#2a2e34",
    platinum: "#e9eaec",
    brightGold: "#fbe134",
    saffron: "#e4b61a",
} as const;

interface StatsData {
    totalLineas: number;
    totalOperadores: number;
    totalMensajes: number;
    mensajesHoy: number;
}

interface Props {
    user: JWTPayload;
}

export default function StatsClient({ user }: Props) {
    const router = useRouter();
    const [stats, setStats] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        try {
            // Simulated fetch - The specialized API for real stats doesn't exist yet
            // But we can build the UI to expect this object format
            setTimeout(() => {
                setStats({
                    totalLineas: user.rol === "admin" ? 4 : 1,
                    totalOperadores: 12,
                    totalMensajes: 15420,
                    mensajesHoy: 342,
                });
                setLoading(false);
            }, 800);
        } catch (error) {
            console.error("Error cargando estadísticas:", error);
            setLoading(false);
        }
    }, [user.rol]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return (
        <div className="min-h-screen flex flex-col" style={{ background: `linear-gradient(135deg, ${C.onyx} 0%, ${C.jetBlack} 100%)` }}>
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 sticky top-0 z-10 backdrop-blur-sm" style={{ backgroundColor: `${C.onyx}cc` }}>
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push("/dashboard")} className="text-sm border px-3 py-1.5 rounded-lg transition-colors cursor-pointer" style={{ borderColor: `${C.platinum}22`, color: C.platinum, backgroundColor: `${C.onyx}80` }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${C.platinum}55`; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${C.platinum}22`; }}
                    >
                        ← Volver
                    </button>
                    <h1 className="text-xl font-bold" style={{ color: C.platinum }}>Estadísticas Globales</h1>
                </div>
            </header>

            <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
                {loading || !stats ? (
                    <div className="flex justify-center items-center h-64">
                        <p style={{ color: `${C.platinum}88` }}>Cargando métricas...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {user.rol === "admin" && (
                            <StatCard title="Líneas Activas" value={stats.totalLineas} icon="🏢" />
                        )}
                        <StatCard title="Operadores" value={stats.totalOperadores} icon="👨‍💻" />
                        <StatCard title="Mensajes (Histórico)" value={stats.totalMensajes.toLocaleString()} icon="💬" />
                        <StatCard title="Mensajes de Hoy" value={stats.mensajesHoy.toLocaleString()} icon="🔥" highlight />
                    </div>
                )}
            </main>
        </div>
    );
}

function StatCard({ title, value, icon, highlight = false }: { title: string, value: string | number, icon: string, highlight?: boolean }) {
    return (
        <div className="p-6 rounded-2xl border flex flex-col gap-2 relative overflow-hidden" 
             style={{ 
                 backgroundColor: highlight ? `${C.saffron}15` : `${C.jetBlack}cc`,
                 borderColor: highlight ? `${C.saffron}44` : 'rgba(255,255,255,0.05)'
             }}>
            {highlight && <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: C.saffron }}></div>}
            <div className="flex items-center gap-3">
                <span className="text-2xl">{icon}</span>
                <h3 className="text-sm font-medium tracking-wide uppercase" style={{ color: highlight ? C.saffron : `${C.platinum}88` }}>
                    {title}
                </h3>
            </div>
            <p className="text-4xl font-bold mt-2" style={{ color: highlight ? C.saffron : C.platinum }}>
                {value}
            </p>
        </div>
    );
}
