"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
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

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Stats {
    chatsActivos: number;
    mensajesHoy: number;
    operadoresEnLinea: number;
    lineasActivas?: number;   // Solo admin global
    mensajesMes?: number;     // Solo admin_linea
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, sub }: { label: string; value: string | number; icon: React.ReactNode; sub?: string }) {
    return (
        <div className="rounded-xl p-5 flex items-start gap-4 border border-white/5 shadow-md" style={{ backgroundColor: `${C.jetBlack}cc` }}>
            <div className="rounded-lg p-3 shrink-0" style={{ backgroundColor: `${C.brightGold}22`, color: C.brightGold }}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-xs font-medium tracking-wide uppercase" style={{ color: `${C.platinum}66` }}>{label}</p>
                <p className="text-3xl font-bold mt-0.5" style={{ color: C.platinum }}>
                    {value === -1 ? <span className="opacity-40 text-xl animate-pulse">—</span> : value}
                </p>
                {sub && <p className="text-xs mt-1" style={{ color: `${C.platinum}55` }}>{sub}</p>}
            </div>
        </div>
    );
}

// ─── Botón de acción rápida ────────────────────────────────────────────────────
function QuickAction({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-left transition-all border border-transparent w-full cursor-pointer"
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
            <span style={{ color: C.brightGold }}>{icon}</span>
            {label}
        </button>
    );
}

// ─── Modal base ───────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
            <div className="w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden" style={{ backgroundColor: C.jetBlack }}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <h2 className="font-semibold text-base" style={{ color: C.platinum }}>{title}</h2>
                    <button onClick={onClose} className="text-xl leading-none opacity-50 hover:opacity-100 transition-opacity cursor-pointer" style={{ color: C.platinum }}>✕</button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
}

// ─── Input helper ─────────────────────────────────────────────────────────────
function Field({ label, id, ...props }: { label: string; id: string } & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={id} className="text-xs font-medium" style={{ color: `${C.platinum}88` }}>{label}</label>
            <input
                id={id}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors"
                style={{ backgroundColor: `${C.onyx}99`, borderColor: `${C.platinum}22`, color: C.platinum }}
                onFocus={(e) => (e.currentTarget.style.borderColor = `${C.brightGold}66`)}
                onBlur={(e) => (e.currentTarget.style.borderColor = `${C.platinum}22`)}
                {...props}
            />
        </div>
    );
}

function SelectField({ label, id, children, ...props }: { label: string; id: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={id} className="text-xs font-medium" style={{ color: `${C.platinum}88` }}>{label}</label>
            <select
                id={id}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                style={{ backgroundColor: C.onyx, borderColor: `${C.platinum}22`, color: C.platinum }}
                {...props}
            >
                {children}
            </select>
        </div>
    );
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
    return (
        <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg font-semibold text-sm transition-opacity cursor-pointer disabled:cursor-not-allowed"
            style={{ backgroundColor: C.brightGold, color: C.onyx, opacity: loading ? 0.6 : 1 }}
        >
            {loading ? "Guardando..." : label}
        </button>
    );
}

// ─── Modal: Nueva conversación ─────────────────────────────────────────────────
function NewChatModal({ onClose }: { onClose: () => void }) {
    const router = useRouter();
    const [numero, setNumero] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        const clean = numero.replace(/\s+/g, "");
        if (!/^\+\d{10,15}$/.test(clean)) {
            setError("Formato inválido. Usa formato internacional: +58...");
            return;
        }
        setLoading(true);
        try {
            if (mensaje.trim()) {
                await fetch("/api/whatsapp/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ phone: clean, message: mensaje.trim(), type: "text" }),
                });
            }
            router.push(`/chat/${clean.replace("+", "")}`);
        } catch {
            setError("No se pudo iniciar la conversación.");
            setLoading(false);
        }
    }

    return (
        <Modal title="Nueva conversación" onClose={onClose}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Field label="Número de WhatsApp" id="chat-numero" type="tel" placeholder="+58424..." value={numero} onChange={(e) => setNumero(e.target.value)} required />
                <div className="flex flex-col gap-1">
                    <label htmlFor="chat-mensaje" className="text-xs font-medium" style={{ color: `${C.platinum}88` }}>Mensaje inicial (opcional)</label>
                    <textarea
                        id="chat-mensaje"
                        rows={3}
                        maxLength={1000}
                        placeholder="Hola, ¿en qué te puedo ayudar?"
                        value={mensaje}
                        onChange={(e) => setMensaje(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none"
                        style={{ backgroundColor: `${C.onyx}99`, borderColor: `${C.platinum}22`, color: C.platinum }}
                    />
                </div>
                {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
                <div className="flex gap-2 pt-1">
                    <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm border cursor-pointer" style={{ borderColor: `${C.platinum}22`, color: `${C.platinum}88` }}>
                        Cancelar
                    </button>
                    <SubmitBtn loading={loading} label="Iniciar chat" />
                </div>
            </form>
        </Modal>
    );
}

// ─── Modal: Nueva línea ────────────────────────────────────────────────────────
type TokenStatus = "idle" | "loading" | "ok" | "error";

function NewLineaModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [form, setForm] = useState({ name: "", whatsapp_number: "", phone_number_id: "", waba_id: "", access_token: "", verify_token: "" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // ── Verificación de token ──────────────────────────────────────────────────
    const [tokenStatus, setTokenStatus] = useState<TokenStatus>("idle");
    const [tokenMsg, setTokenMsg] = useState("");

    /** Resetea el estado de verificación cuando cambian las credenciales clave */
    const setCredentialField = (k: "access_token" | "phone_number_id") =>
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setForm(f => ({ ...f, [k]: e.target.value }));
            setTokenStatus("idle");
            setTokenMsg("");
        };

    const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

    async function handleVerify() {
        if (!form.access_token.trim() || !form.phone_number_id.trim()) return;
        setTokenStatus("loading");
        setTokenMsg("");
        try {
            const res = await fetch("/api/whatsapp/verify-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ access_token: form.access_token, phone_number_id: form.phone_number_id }),
            });
            const data = await res.json();
            if (data.ok) {
                setTokenStatus("ok");
                setTokenMsg(`✓ Conectado: ${data.name}${data.display_phone_number ? ` (${data.display_phone_number})` : ""}`);
            } else {
                setTokenStatus("error");
                setTokenMsg(data.error || "Credenciales inválidas.");
            }
        } catch {
            setTokenStatus("error");
            setTokenMsg("Error de red al contactar Meta API.");
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (tokenStatus !== "ok") {
            setError("Verifica las credenciales de Meta antes de guardar.");
            return;
        }
        setError("");
        setLoading(true);
        try {
            const res = await fetch("/api/admin/lineas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            onSuccess();
            onClose();
        } catch (err: unknown) {
            setError((err as Error).message || "Error al crear la línea.");
        } finally {
            setLoading(false);
        }
    }

    const tokenColor = { idle: `${C.platinum}44`, loading: C.saffron, ok: "#4ade80", error: "#f87171" }[tokenStatus];
    const canVerify = form.access_token.trim() !== "" && form.phone_number_id.trim() !== "";

    return (
        <Modal title="Nueva línea de taxis" onClose={onClose}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Field label="Nombre comercial *" id="linea-name" value={form.name} onChange={set("name")} placeholder="Ej: Taxi El Llano" required />
                <Field label="Número de WhatsApp Business *" id="linea-wa-number" type="tel" value={form.whatsapp_number} onChange={set("whatsapp_number")} placeholder="+58424..." required />
                <div className="border-t border-white/5 pt-3 flex flex-col gap-1">
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.saffron }}>Credenciales de Meta for Developers</p>
                    <div className="flex flex-col gap-3">
                        <Field label="Phone Number ID *" id="linea-phone-id" value={form.phone_number_id} onChange={setCredentialField("phone_number_id")} placeholder="Ej: 1234567890" required />
                        <Field label="WABA ID *" id="linea-waba-id" value={form.waba_id} onChange={set("waba_id")} placeholder="WhatsApp Business Account ID" required />
                        <Field label="Access Token (System User Token) *" id="linea-token" type="password" value={form.access_token} onChange={setCredentialField("access_token")} placeholder="EAAxxxxx..." required />

                        {/* ── Botón de verificación ── */}
                        <div className="flex flex-col gap-1.5">
                            <button
                                type="button"
                                onClick={handleVerify}
                                disabled={!canVerify || tokenStatus === "loading"}
                                className="w-full py-2 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-2"
                                style={{
                                    borderColor: tokenColor,
                                    color: tokenColor,
                                    backgroundColor: `${tokenColor}18`,
                                    opacity: !canVerify || tokenStatus === "loading" ? 0.5 : 1,
                                    cursor: !canVerify || tokenStatus === "loading" ? "not-allowed" : "pointer",
                                }}
                            >
                                {tokenStatus === "loading" && (
                                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                )}
                                {tokenStatus === "loading" ? "Verificando..." : "Verificar conexión con Meta API"}
                            </button>
                            {tokenMsg && (
                                <p className="text-xs px-1" style={{ color: tokenColor }}>
                                    {tokenMsg}
                                </p>
                            )}
                        </div>

                        <Field label="Verify Token (webhook)" id="linea-verify" value={form.verify_token} onChange={set("verify_token")} placeholder="Token de verificación del webhook" />
                    </div>
                </div>
                {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
                <div className="flex gap-2 pt-1">
                    <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm border cursor-pointer" style={{ borderColor: `${C.platinum}22`, color: `${C.platinum}88` }}>
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading || tokenStatus !== "ok"}
                        className="flex-1 py-2.5 rounded-lg font-semibold text-sm transition-opacity"
                        style={{
                            backgroundColor: C.brightGold,
                            color: C.onyx,
                            opacity: loading || tokenStatus !== "ok" ? 0.4 : 1,
                            cursor: loading || tokenStatus !== "ok" ? "not-allowed" : "pointer",
                        }}
                        title={tokenStatus !== "ok" ? "Verifica las credenciales primero" : undefined}
                    >
                        {loading ? "Guardando..." : "Crear línea"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

// ─── Modal: Nuevo operador ─────────────────────────────────────────────────────
function NewOperadorModal({ user, lineas, onClose, onSuccess }: {
    user: JWTPayload;
    lineas: { _id: string; name: string }[];
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [form, setForm] = useState({ nombre: "", apellido: "", username: "", password: "", email: "", rol: "operador", linea: user.linea || "" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        if (form.password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
        setLoading(true);
        try {
            const res = await fetch("/api/admin/operadores", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || "Error al crear el operador.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Modal title="Nuevo operador" onClose={onClose}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Nombre *" id="op-nombre" value={form.nombre} onChange={set("nombre")} required />
                    <Field label="Apellido *" id="op-apellido" value={form.apellido} onChange={set("apellido")} required />
                </div>
                <Field label="Username *" id="op-username" value={form.username} onChange={set("username")} placeholder="sin espacios, minúsculas" required />
                <Field label="Contraseña *" id="op-pass" type="password" value={form.password} onChange={set("password")} placeholder="Mín. 8 caracteres" required />
                <Field label="Email (opcional)" id="op-email" type="email" value={form.email} onChange={set("email")} />
                {user.rol === "admin" && (
                    <>
                        <SelectField label="Rol *" id="op-rol" value={form.rol} onChange={set("rol") as any}>
                            <option value="operador">Operador</option>
                            <option value="admin_linea">Admin de línea</option>
                        </SelectField>
                        <SelectField label="Línea *" id="op-linea" value={form.linea} onChange={set("linea") as any}>
                            <option value="">— Selecciona una línea —</option>
                            {lineas.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
                        </SelectField>
                    </>
                )}
                {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
                <div className="flex gap-2 pt-1">
                    <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm border cursor-pointer" style={{ borderColor: `${C.platinum}22`, color: `${C.platinum}88` }}>
                        Cancelar
                    </button>
                    <SubmitBtn loading={loading} label="Crear operador" />
                </div>
            </form>
        </Modal>
    );
}

// ─── Etiqueta de estado de turno ───────────────────────────────────────────────
const ESTADO_LABELS: Record<string, { label: string; color: string }> = {
    en_linea: { label: "En línea", color: "#4ade80" },
    turno_abierto: { label: "Turno abierto", color: C.brightGold },
    ocupado: { label: "Ocupado", color: "#fb923c" },
    fuera_de_turno: { label: "Fuera de turno", color: `${C.platinum}44` },
};

// ─── Dashboard principal ───────────────────────────────────────────────────────
export default function DashboardClient({ user }: DashboardClientProps) {
    const router = useRouter();

    const [stats, setStats] = useState<Stats>({ chatsActivos: -1, mensajesHoy: -1, operadoresEnLinea: -1 });
    const [myStatus, setMyStatus] = useState<string>("fuera_de_turno");
    const [statusLoading, setStatusLoading] = useState(false);
    const [lineas, setLineas] = useState<{ _id: string; name: string }[]>([]);

    // Modales
    const [modal, setModal] = useState<"chat" | "linea" | "operador" | null>(null);

    // ── Fetch stats ────────────────────────────────────────────────────────────
    const fetchStats = useCallback(async () => {
        const endpoint = user.rol === "admin" ? "/api/estadisticas/global" : "/api/estadisticas/linea";
        try {
            const res = await fetch(endpoint);
            const data = await res.json();
            if (data.ok) setStats(data.data);
        } catch { /* stats quedan en placeholder */ }
    }, [user.rol]);

    const fetchLineas = useCallback(async () => {
        if (user.rol !== "admin") return;
        try {
            const res = await fetch("/api/admin/lineas");
            const data = await res.json();
            if (data.ok) setLineas(data.data);
        } catch { /* silencioso */ }
    }, [user.rol]);

    useEffect(() => {
        fetchStats();
        fetchLineas();
    }, [fetchStats, fetchLineas]);

    // ── Cambio de estado ───────────────────────────────────────────────────────
    async function handleStatusChange(newStatus: string) {
        setStatusLoading(true);
        try {
            const res = await fetch("/api/operadores/me/status", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            const data = await res.json();
            if (data.ok) setMyStatus(data.status);
        } finally {
            setStatusLoading(false);
        }
    }

    async function handleLogout() {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
    }

    const initials = user.nombre.charAt(0).toUpperCase();
    const rolLabel = { admin: "Administrador", admin_linea: "Admin de Línea", operador: "Operador" }[user.rol] ?? "—";

    return (
        <div className="min-h-screen flex flex-col" style={{ background: `linear-gradient(135deg, ${C.onyx} 0%, ${C.jetBlack} 100%)` }}>

            {/* ── Modales ─────────────────────────────────────────────────────── */}
            {modal === "chat" && <NewChatModal onClose={() => setModal(null)} />}
            {modal === "linea" && <NewLineaModal onClose={() => setModal(null)} onSuccess={() => { fetchStats(); fetchLineas(); }} />}
            {modal === "operador" && <NewOperadorModal user={user} lineas={lineas} onClose={() => setModal(null)} onSuccess={fetchStats} />}

            {/* ── Topbar ──────────────────────────────────────────────────────── */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 sticky top-0 z-10 backdrop-blur-sm" style={{ backgroundColor: `${C.onyx}cc` }}>
                <div className="flex items-center gap-3">
                    <span className="text-2xl font-extrabold tracking-tight" style={{ color: C.brightGold }}>Taximast</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full border" style={{ color: C.saffron, borderColor: `${C.saffron}55`, backgroundColor: `${C.saffron}15` }}>
                        {rolLabel}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-semibold leading-none" style={{ color: C.platinum }}>{user.nombre}</p>
                        <p className="text-xs mt-0.5" style={{ color: `${C.platinum}66` }}>{rolLabel}</p>
                    </div>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0" style={{ backgroundColor: C.brightGold, color: C.onyx }}>
                        {initials}
                    </div>
                    <button onClick={handleLogout} className="text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer" style={{ color: `${C.platinum}88`, borderColor: `${C.platinum}22`, backgroundColor: "transparent" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${C.platinum}55`; (e.currentTarget as HTMLButtonElement).style.color = C.platinum; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${C.platinum}22`; (e.currentTarget as HTMLButtonElement).style.color = `${C.platinum}88`; }}
                    >
                        Cerrar sesión
                    </button>
                </div>
            </header>

            {/* ── Contenido ───────────────────────────────────────────────────── */}
            <main className="flex-1 p-6 max-w-6xl mx-auto w-full">

                {/* Saludo */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold" style={{ color: C.platinum }}>Bienvenido, {user.nombre} 👋</h1>
                    <p className="text-sm mt-1" style={{ color: `${C.platinum}66` }}>
                        {user.rol === "admin" ? "Vista global — todas las líneas" : "Resumen de tu línea"}
                    </p>
                </div>

                {/* ── Estadísticas ─────────────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <StatCard label="Chats activos" value={stats.chatsActivos} sub="Hoy" icon={<ChatIcon />} />
                    <StatCard label="Mensajes hoy" value={stats.mensajesHoy} sub="Últimas 24 h" icon={<MessageIcon />} />
                    <StatCard label="Operadores en turno" value={stats.operadoresEnLinea} sub="Activos ahora" icon={<UserIcon />} />
                    {user.rol === "admin"
                        ? <StatCard label="Líneas activas" value={stats.lineasActivas ?? -1} sub="Integradas" icon={<LineIcon />} />
                        : <StatCard label="Mensajes del mes" value={stats.mensajesMes ?? -1} sub="Acumulado" icon={<LineIcon />} />
                    }
                </div>

                {/* ── Panel inferior ───────────────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Resumen de líneas (solo admin) */}
                    {user.rol === "admin" && (
                        <div className="rounded-xl p-6 border border-white/5 shadow-md flex flex-col gap-3" style={{ backgroundColor: `${C.jetBlack}cc` }}>
                            <div className="flex items-center justify-between">
                                <h2 className="font-semibold text-sm" style={{ color: C.platinum }}>Líneas registradas</h2>
                                <button onClick={() => router.push("/admin/lineas")} className="text-xs hover:underline cursor-pointer" style={{ color: C.saffron }}>Ver todas →</button>
                            </div>
                            {lineas.length === 0
                                ? <p className="text-sm flex-1 flex items-center justify-center" style={{ color: `${C.platinum}33` }}>No hay líneas aún</p>
                                : <ul className="flex flex-col gap-2 mt-1">
                                    {lineas.slice(0, 4).map((l) => (
                                        <li key={l._id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: `${C.onyx}66` }}>
                                            <span className="text-sm" style={{ color: C.platinum }}>{l.name}</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${C.brightGold}22`, color: C.brightGold }}>Activa</span>
                                        </li>
                                    ))}
                                </ul>
                            }
                        </div>
                    )}

                    {/* Chats recientes (todos los roles) */}
                    {user.rol !== "admin" && (
                        <div className="rounded-xl p-6 border border-white/5 shadow-md min-h-48 flex flex-col gap-3" style={{ backgroundColor: `${C.jetBlack}cc` }}>
                            <div className="flex items-center justify-between">
                                <h2 className="font-semibold text-sm" style={{ color: C.platinum }}>Chats recientes</h2>
                                <span className="text-xs" style={{ color: `${C.platinum}44` }}>Próximamente</span>
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                                <p className="text-sm text-center" style={{ color: `${C.platinum}33` }}>Los chats aparecerán aquí</p>
                            </div>
                        </div>
                    )}

                    {/* Acciones rápidas */}
                    <div className="rounded-xl p-6 border border-white/5 shadow-md flex flex-col gap-3" style={{ backgroundColor: `${C.jetBlack}cc` }}>
                        <h2 className="font-semibold text-sm" style={{ color: C.platinum }}>Acciones rápidas</h2>
                        <div className="flex flex-col gap-2 mt-1">
                            <QuickAction label="Nueva conversación" icon={<ChatIcon className="w-4 h-4" />} onClick={() => setModal("chat")} />
                            <QuickAction label="Ir a chats" icon={<ChatIcon className="w-4 h-4" />} onClick={() => router.push("/chat")} />

                            {/* Estado de turno — operador y admin_linea */}
                            {user.rol !== "admin" && (
                                <div className="flex flex-col gap-1.5 mt-1">
                                    <p className="text-xs font-medium" style={{ color: `${C.platinum}66` }}>Mi estado</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(ESTADO_LABELS).map(([key, { label, color }]) => (
                                            <button
                                                key={key}
                                                disabled={statusLoading || myStatus === key}
                                                onClick={() => handleStatusChange(key)}
                                                className="py-2 px-3 rounded-lg text-xs font-medium border transition-all cursor-pointer disabled:cursor-not-allowed"
                                                style={{
                                                    borderColor: myStatus === key ? color : `${C.platinum}22`,
                                                    color: myStatus === key ? color : `${C.platinum}66`,
                                                    backgroundColor: myStatus === key ? `${color}14` : "transparent",
                                                }}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Admin de línea */}
                            {(user.rol === "admin" || user.rol === "admin_linea") && (
                                <QuickAction label="Gestionar operadores" icon={<UserIcon className="w-4 h-4" />} onClick={() => router.push("/admin/operadores")} />
                            )}
                            {(user.rol === "admin" || user.rol === "admin_linea") && (
                                <QuickAction label="Ver estadísticas" icon={<LineIcon className="w-4 h-4" />} onClick={() => router.push("/admin/estadisticas")} />
                            )}

                            {/* Solo admin global */}
                            {user.rol === "admin" && (
                                <>
                                    <QuickAction label="Gestionar líneas" icon={<LineIcon className="w-4 h-4" />} onClick={() => router.push("/admin/lineas")} />
                                    <QuickAction label="+ Nueva línea" icon={<PlusIcon className="w-4 h-4" />} onClick={() => setModal("linea")} />
                                    <QuickAction label="+ Nuevo operador" icon={<PlusIcon className="w-4 h-4" />} onClick={() => setModal("operador")} />
                                </>
                            )}

                            {user.rol === "admin_linea" && (
                                <QuickAction label="+ Nuevo operador" icon={<PlusIcon className="w-4 h-4" />} onClick={() => setModal("operador")} />
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

/* ─── Iconos SVG ─── */
function ChatIcon({ className = "w-5 h-5" }: { className?: string }) {
    return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
}
function MessageIcon({ className = "w-5 h-5" }: { className?: string }) {
    return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
}
function UserIcon({ className = "w-5 h-5" }: { className?: string }) {
    return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>;
}
function LineIcon({ className = "w-5 h-5" }: { className?: string }) {
    return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
}
function PlusIcon({ className = "w-5 h-5" }: { className?: string }) {
    return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}
