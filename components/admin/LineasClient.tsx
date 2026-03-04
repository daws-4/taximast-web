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

interface Linea {
    _id: string;
    name: string;
    whatsapp_number: string;
    phone_number_id?: string;
    waba_id?: string;
    activa: boolean;
}

interface Props {
    user: JWTPayload;
}

export default function LineasClient({ user }: Props) {
    const router = useRouter();
    const [lineas, setLineas] = useState<Linea[]>([]);
    const [loading, setLoading] = useState(true);

    const [modal, setModal] = useState<"create" | "edit" | null>(null);
    const [editLinea, setEditLinea] = useState<Linea | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/lineas");
            const data = await res.json();
            if (data.ok) setLineas(data.data);
        } catch (error) {
            console.error("Error cargando líneas:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCreateClick = () => setModal("create");

    const handleEditClick = (linea: Linea) => {
        setEditLinea(linea);
        setModal("edit");
    };

    const handleSuccess = () => {
        setModal(null);
        setEditLinea(null);
        fetchData();
    };

    return (
        <div className="min-h-screen flex flex-col" style={{ background: `linear-gradient(135deg, ${C.onyx} 0%, ${C.jetBlack} 100%)` }}>
            {/* Topbar */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 sticky top-0 z-10 backdrop-blur-sm" style={{ backgroundColor: `${C.onyx}cc` }}>
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push("/dashboard")} className="text-sm border px-3 py-1.5 rounded-lg transition-colors cursor-pointer" style={{ borderColor: `${C.platinum}22`, color: C.platinum, backgroundColor: `${C.onyx}80` }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${C.platinum}55`; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${C.platinum}22`; }}
                    >
                        ← Volver
                    </button>
                    <h1 className="text-xl font-bold" style={{ color: C.platinum }}>Gestión de Líneas</h1>
                </div>
                {user.rol === "admin" && (
                    <button onClick={handleCreateClick} className="text-sm font-semibold px-4 py-2 rounded-lg transition-opacity cursor-pointer" style={{ backgroundColor: C.brightGold, color: C.onyx }}>
                        + Nueva Línea
                    </button>
                )}
            </header>

            <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
                <div className="rounded-xl border border-white/5 shadow-md overflow-hidden flex flex-col" style={{ backgroundColor: `${C.jetBlack}cc` }}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5" style={{ backgroundColor: `${C.onyx}80` }}>
                                    <th className="p-4 text-xs font-semibold tracking-wide uppercase" style={{ color: `${C.platinum}88` }}>Línea</th>
                                    <th className="p-4 text-xs font-semibold tracking-wide uppercase" style={{ color: `${C.platinum}88` }}>WhatsApp</th>
                                    <th className="p-4 text-xs font-semibold tracking-wide uppercase" style={{ color: `${C.platinum}88` }}>Estado</th>
                                    <th className="p-4 text-xs font-semibold tracking-wide uppercase text-right" style={{ color: `${C.platinum}88` }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={4} className="p-8 text-center" style={{ color: `${C.platinum}66` }}>Cargando líneas...</td></tr>
                                ) : lineas.length === 0 ? (
                                    <tr><td colSpan={4} className="p-8 text-center" style={{ color: `${C.platinum}66` }}>No existen líneas registradas.</td></tr>
                                ) : (
                                    lineas.map((linea) => (
                                        <tr key={linea._id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                                            <td className="p-4">
                                                <div className="font-medium text-sm" style={{ color: C.platinum }}>{linea.name}</div>
                                                <div className="text-xs mt-0.5 font-mono" style={{ color: `${C.platinum}55` }}>ID: {linea._id}</div>
                                            </td>
                                            <td className="p-4 text-sm" style={{ color: C.platinum }}>{linea.whatsapp_number}</td>
                                            <td className="p-4">
                                                {linea.activa ? (
                                                    <span className="text-xs px-2 py-1 rounded-full border bg-opacity-10" style={{ color: '#4ade80', borderColor: '#4ade8044', backgroundColor: '#4ade8015' }}>Activa</span>
                                                ) : (
                                                    <span className="text-xs px-2 py-1 rounded-full border bg-opacity-10" style={{ color: '#f87171', borderColor: '#f8717144', backgroundColor: '#f8717115' }}>Inactiva</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right flex gap-2 justify-end">
                                                <button
                                                    onClick={() => handleEditClick(linea)}
                                                    className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer border"
                                                    style={{ color: C.saffron, borderColor: `${C.saffron}44`, backgroundColor: `${C.saffron}11` }}
                                                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${C.saffron}22`; }}
                                                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${C.saffron}11`; }}
                                                >
                                                    Gestionar
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {modal === "create" && <NewLineaModal onClose={() => setModal(null)} onSuccess={handleSuccess} />}
            {modal === "edit" && editLinea && <EditLineaModal linea={editLinea} onClose={() => setModal(null)} onSuccess={handleSuccess} />}
        </div>
    );
}

// ─── Componentes UI Básicos ────────────────────────────────────────────────

function ModalOverlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden my-auto relative" style={{ backgroundColor: C.jetBlack }}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 sticky top-0 z-10" style={{ backgroundColor: C.jetBlack }}>
                    <h2 className="font-semibold text-base" style={{ color: C.platinum }}>{title}</h2>
                    <button onClick={onClose} className="text-xl leading-none opacity-50 hover:opacity-100 transition-opacity cursor-pointer" style={{ color: C.platinum }}>✕</button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
}

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

// ─── Modal: Editar Línea ───────────────────────────────────────────────────
type TokenStatus = "idle" | "loading" | "ok" | "error";

function EditLineaModal({ linea, onClose, onSuccess }: {
    linea: Linea;
    onClose: () => void;
    onSuccess: () => void;
}) {
    // Al editar, los campos opcionales vienen vacíos al cliente por seguridad. Si se envían vacíos evitamos sobreescribirlos.
    const [form, setForm] = useState({
        name: linea.name,
        whatsapp_number: linea.whatsapp_number,
        phone_number_id: "",
        waba_id: "",
        access_token: "",
        verify_token: "",
        activa: linea.activa
    });

    const [loading, setLoading] = useState(false);
    const [delLoading, setDelLoading] = useState(false);
    const [error, setError] = useState("");

    // Verificación de Meta 
    const [tokenStatus, setTokenStatus] = useState<TokenStatus>("idle");
    const [tokenMsg, setTokenMsg] = useState("");

    const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
    const setCredentialField = (k: "access_token" | "phone_number_id") => (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm(f => ({ ...f, [k]: e.target.value }));
        setTokenStatus("idle");
        setTokenMsg("");
    };

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

        // Solo requerir verificación de token si el usuario intentó actualizar esos campos manualmente
        const editingCredentials = form.access_token.trim() !== "" || form.phone_number_id.trim() !== "";
        if (editingCredentials && tokenStatus !== "ok") {
            setError("Verifica las nuevas credenciales de Meta antes de guardar usando el botón de verificación.");
            return;
        }

        setError("");
        setLoading(true);

        // Omitimos los campos en blanco para que el backend no los sobreescriba (conserva los originales)
        const payload: Partial<typeof form> = {};
        for (const [k, v] of Object.entries(form)) {
            if (v !== "" && v !== undefined && k !== "activa") {
                payload[k as keyof typeof form] = v as never;
            } else if (k === "activa") {
                payload.activa = v as boolean;
            }
        }

        try {
            const res = await fetch(`/api/admin/lineas/${linea._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            onSuccess();
        } catch (err: any) {
            setError(err.message || "Error al actualizar la línea. Revisa las credenciales.");
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete() {
        if (!confirm(`¿Estás seguro de eliminar a la línea ${linea.name}? Esto podría fallar si aún tiene operadores vinculados.`)) return;
        setDelLoading(true);
        try {
            const res = await fetch(`/api/admin/lineas/${linea._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            onSuccess();
        } catch (err: any) {
            setError(err.message || "Error al eliminar línea.");
            setDelLoading(false);
        }
    }

    const tokenColor = { idle: `${C.platinum}44`, loading: C.saffron, ok: "#4ade80", error: "#f87171" }[tokenStatus];
    const canVerify = form.access_token.trim() !== "" && form.phone_number_id.trim() !== "";

    return (
        <ModalOverlay title={`Editar: ${linea.name}`} onClose={onClose}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Field label="Nombre comercial" id="edit-linea-name" value={form.name} onChange={set("name")} required />
                <Field label="Número de WhatsApp Business" id="edit-linea-wa-number" type="tel" value={form.whatsapp_number} onChange={set("whatsapp_number")} required />

                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input type="checkbox" checked={form.activa} onChange={set("activa")} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-gray-700 border-gray-600" />
                    <span className="text-sm" style={{ color: C.platinum }}>Línea Operativa (Activa)</span>
                </label>

                <div className="border-t border-white/5 pt-3 flex flex-col gap-1 mt-2">
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.saffron }}>Actualizar Credenciales de Meta</p>
                    <p className="text-xs mb-3" style={{ color: `${C.platinum}66` }}>
                        Deja en blanco los campos que no desees cambiar. Si los actualizas, valida la conexión antes de guardar.
                    </p>

                    <div className="flex flex-col gap-3">
                        <Field label="Nuevo Phone Number ID" id="edit-linea-phone-id" value={form.phone_number_id} onChange={setCredentialField("phone_number_id")} placeholder="Solo si vas a cambiarlo" />
                        <Field label="Nuevo WABA ID" id="edit-linea-waba-id" value={form.waba_id} onChange={set("waba_id")} placeholder="Solo si vas a cambiarlo" />
                        <Field label="Nuevo Access Token (System User Token)" id="edit-linea-token" type="password" value={form.access_token} onChange={setCredentialField("access_token")} placeholder="EAAxxxxx..." />

                        {/* Botón de verificación condicional */}
                        <div className="flex flex-col gap-1.5 transition-all">
                            <button
                                type="button"
                                onClick={handleVerify}
                                disabled={!canVerify || tokenStatus === "loading"}
                                className={`w-full py-2 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-2`}
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
                                {tokenStatus === "loading" ? "Verificando..." : "Verificar nuevas credenciales"}
                            </button>
                            {tokenMsg && (
                                <p className="text-xs px-1" style={{ color: tokenColor }}>
                                    {tokenMsg}
                                </p>
                            )}
                        </div>

                        <Field label="Nuevo Verify Token (webhook)" id="edit-linea-verify" value={form.verify_token} onChange={set("verify_token")} placeholder="Solo si vas a cambiarlo" />
                    </div>
                </div>

                {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}

                <div className="flex gap-2 pt-4 mt-2 border-t border-white/5">
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={delLoading}
                        className="px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer disabled:opacity-50"
                        style={{ color: "#ef4444", borderColor: "#ef444444", backgroundColor: "#ef444415" }}
                    >
                        {delLoading ? "..." : "Eliminar"}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-lg text-sm border cursor-pointer transition-colors hover:bg-white/5"
                        style={{ borderColor: `${C.platinum}22`, color: `${C.platinum}88` }}
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading || (canVerify && tokenStatus !== "ok")}
                        className="flex-1 py-2.5 rounded-lg font-semibold text-sm transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: C.brightGold, color: C.onyx }}
                    >
                        {loading ? "Guardando..." : "Guardar Cambios"}
                    </button>
                </div>
            </form>
        </ModalOverlay>
    );
}

// ─── Modal: Nueva Línea ────────────────────────────────────────────────────
function NewLineaModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [form, setForm] = useState({ name: "", whatsapp_number: "", phone_number_id: "", waba_id: "", access_token: "", verify_token: "" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [tokenStatus, setTokenStatus] = useState<TokenStatus>("idle");
    const [tokenMsg, setTokenMsg] = useState("");

    const setCredentialField = (k: "access_token" | "phone_number_id") => (e: React.ChangeEvent<HTMLInputElement>) => {
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
        } catch (err: any) {
            setError(err.message || "Error al crear la línea.");
        } finally {
            setLoading(false);
        }
    }

    const tokenColor = { idle: `${C.platinum}44`, loading: C.saffron, ok: "#4ade80", error: "#f87171" }[tokenStatus];
    const canVerify = form.access_token.trim() !== "" && form.phone_number_id.trim() !== "";

    return (
        <ModalOverlay title="Nueva línea de taxis" onClose={onClose}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Field label="Nombre comercial *" id="new-linea-name" value={form.name} onChange={set("name")} placeholder="Ej: Taxi El Llano" required />
                <Field label="Número de WhatsApp Business *" id="new-linea-wa-number" type="tel" value={form.whatsapp_number} onChange={set("whatsapp_number")} placeholder="+58424..." required />

                <div className="border-t border-white/5 pt-3 flex flex-col gap-1 mt-2">
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.saffron }}>Credenciales de Meta for Developers</p>
                    <div className="flex flex-col gap-3">
                        <Field label="Phone Number ID *" id="new-linea-phone-id" value={form.phone_number_id} onChange={setCredentialField("phone_number_id")} placeholder="Ej: 1234567890" required />
                        <Field label="WABA ID *" id="new-linea-waba-id" value={form.waba_id} onChange={set("waba_id")} placeholder="WhatsApp Business Account ID" required />
                        <Field label="Access Token (System User Token) *" id="new-linea-token" type="password" value={form.access_token} onChange={setCredentialField("access_token")} placeholder="EAAxxxxx..." required />

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

                        <Field label="Verify Token (webhook)" id="new-linea-verify" value={form.verify_token} onChange={set("verify_token")} placeholder="Token de verificación del webhook" />
                    </div>
                </div>
                {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
                <div className="flex gap-2 pt-1 mt-2">
                    <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm border cursor-pointer hover:bg-white/5 transition-colors" style={{ borderColor: `${C.platinum}22`, color: `${C.platinum}88` }}>
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
                    >
                        {loading ? "Guardando..." : "Crear línea"}
                    </button>
                </div>
            </form>
        </ModalOverlay>
    );
}
