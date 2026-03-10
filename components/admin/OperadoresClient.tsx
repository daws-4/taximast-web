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

interface Operador {
    _id: string;
    nombre: string;
    apellido: string;
    username: string;
    email?: string;
    rol: "admin" | "operador" | "admin_linea";
    status: string;
    linea: { _id: string; name: string } | null;
}

interface Linea {
    _id: string;
    name: string;
}

interface Props {
    user: JWTPayload;
}

export default function OperadoresClient({ user }: Props) {
    const router = useRouter();
    const [operadores, setOperadores] = useState<Operador[]>([]);
    const [lineas, setLineas] = useState<Linea[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [editOp, setEditOp] = useState<Operador | null>(null);
    const [showCreate, setShowCreate] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [opsRes, lineasRes] = await Promise.all([
                fetch("/api/admin/operadores"),
                user.rol === "admin" ? fetch("/api/admin/lineas") : Promise.resolve(null),
            ]);

            const opsData = await opsRes.json();
            if (opsData.ok) setOperadores(opsData.data);

            if (lineasRes) {
                const lineasData = await lineasRes.json();
                if (lineasData.ok) setLineas(lineasData.data);
            }
        } catch (error) {
            console.error("Error cargando datos:", error);
        } finally {
            setLoading(false);
        }
    }, [user.rol]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEditSave = () => {
        setEditOp(null);
        fetchData();
    };

    return (
        <div className="min-h-screen flex flex-col" style={{ background: `linear-gradient(135deg, ${C.onyx} 0%, ${C.jetBlack} 100%)` }}>
            {/* Topbar (similar to dashboard) */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 sticky top-0 z-10 backdrop-blur-sm" style={{ backgroundColor: `${C.onyx}cc` }}>
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push("/dashboard")} className="text-sm border px-3 py-1.5 rounded-lg transition-colors cursor-pointer" style={{ borderColor: `${C.platinum}22`, color: C.platinum, backgroundColor: `${C.onyx}80` }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${C.platinum}55`; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${C.platinum}22`; }}
                    >
                        ← Volver
                    </button>
                    <h1 className="text-xl font-bold" style={{ color: C.platinum }}>Gestión de Operadores</h1>
                </div>
                {user.rol === "admin" || user.rol === "admin_linea" ? (
                    <button
                        onClick={() => setShowCreate(true)}
                        className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                        style={{ backgroundColor: C.brightGold, color: C.onyx }}
                    >
                        + Nuevo Operador
                    </button>
                ) : null}
            </header>

            <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
                {/* Operadores List */}
                <div className="rounded-xl border border-white/5 shadow-md overflow-hidden flex flex-col" style={{ backgroundColor: `${C.jetBlack}cc` }}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5" style={{ backgroundColor: `${C.onyx}80` }}>
                                    <th className="p-4 text-xs font-semibold tracking-wide uppercase" style={{ color: `${C.platinum}88` }}>Nombre</th>
                                    <th className="p-4 text-xs font-semibold tracking-wide uppercase" style={{ color: `${C.platinum}88` }}>Usuario</th>
                                    <th className="p-4 text-xs font-semibold tracking-wide uppercase" style={{ color: `${C.platinum}88` }}>Rol</th>
                                    <th className="p-4 text-xs font-semibold tracking-wide uppercase" style={{ color: `${C.platinum}88` }}>Línea</th>
                                    <th className="p-4 text-xs font-semibold tracking-wide uppercase text-right" style={{ color: `${C.platinum}88` }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={5} className="p-8 text-center" style={{ color: `${C.platinum}66` }}>Cargando operadores...</td></tr>
                                ) : operadores.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center" style={{ color: `${C.platinum}66` }}>No se encontraron operadores.</td></tr>
                                ) : (
                                    operadores.map((op) => (
                                        <tr key={op._id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                                            <td className="p-4">
                                                <div className="font-medium text-sm" style={{ color: C.platinum }}>{op.nombre} {op.apellido}</div>
                                                <div className="text-xs mt-0.5" style={{ color: `${C.platinum}55` }}>{op.email || "Sin email"}</div>
                                            </td>
                                            <td className="p-4 text-sm" style={{ color: C.platinum }}>{op.username}</td>
                                            <td className="p-4">
                                                <span className="text-xs px-2 py-1 rounded-full border bg-opacity-10" style={{
                                                    color: op.rol === 'admin' ? '#ef4444' : (op.rol === 'admin_linea' ? C.saffron : '#3b82f6'),
                                                    borderColor: op.rol === 'admin' ? '#ef444444' : (op.rol === 'admin_linea' ? `${C.saffron}44` : '#3b82f644'),
                                                    backgroundColor: op.rol === 'admin' ? '#ef444415' : (op.rol === 'admin_linea' ? `${C.saffron}15` : '#3b82f615'),
                                                }}>
                                                    {op.rol}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm" style={{ color: `${C.platinum}88` }}>
                                                {op.linea ? op.linea.name : "N/A"}
                                            </td>
                                            <td className="p-4 text-right">
                                                {!(user.rol === "admin_linea" && (op.rol === "admin" || (op.rol === "admin_linea" && op._id !== user.id))) && (
                                                    <button
                                                        onClick={() => setEditOp(op)}
                                                        className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer border"
                                                        style={{ color: C.saffron, borderColor: `${C.saffron}44`, backgroundColor: `${C.saffron}11` }}
                                                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${C.saffron}22`; }}
                                                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${C.saffron}11`; }}
                                                    >
                                                        Editar
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {editOp && (
                <EditOperadorModal
                    operador={editOp}
                    lineas={lineas}
                    user={user}
                    onClose={() => setEditOp(null)}
                    onSuccess={handleEditSave}
                />
            )}

            {showCreate && (
                <CreateOperadorModal
                    lineas={lineas}
                    user={user}
                    onClose={() => setShowCreate(false)}
                    onSuccess={() => {
                        setShowCreate(false);
                        fetchData();
                    }}
                />
            )}
        </div>
    );
}

// ─── Modal: Editar Operador ──────────────────────────────────────────────────
function EditOperadorModal({ operador, lineas, user, onClose, onSuccess }: {
    operador: Operador;
    lineas: Linea[];
    user: JWTPayload;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [form, setForm] = useState({
        nombre: operador.nombre,
        apellido: operador.apellido,
        username: operador.username,
        email: operador.email || "",
        password: "",
        rol: operador.rol,
        genero: (operador as any).genero || "M",
        linea: operador.linea?._id || "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [delLoading, setDelLoading] = useState(false);

    const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const payload: any = { ...form };
            if (!payload.password) {
                delete payload.password;
            }

            const res = await fetch(`/api/admin/operadores/${operador._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            onSuccess();
        } catch (err: any) {
            setError(err.message || "Error al actualizar.");
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete() {
        if (!confirm(`¿Estás seguro de eliminar a ${operador.nombre} ${operador.apellido}?`)) return;
        setDelLoading(true);
        try {
            const res = await fetch(`/api/admin/operadores/${operador._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            onSuccess();
        } catch (err: any) {
            setError(err.message || "Error al eliminar operador.");
            setDelLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden" style={{ backgroundColor: C.jetBlack }}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <h2 className="font-semibold text-base" style={{ color: C.platinum }}>Editar {operador.username}</h2>
                    <button onClick={onClose} className="text-xl leading-none opacity-50 hover:opacity-100 transition-opacity cursor-pointer" style={{ color: C.platinum }}>✕</button>
                </div>
                <div className="p-6">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Nombre" id="edit-nombre" value={form.nombre} onChange={set("nombre")} required />
                            <Field label="Apellido" id="edit-apellido" value={form.apellido} onChange={set("apellido")} required />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Nombre de Usuario" id="edit-username" value={form.username} onChange={set("username")} required />
                            <SelectField label="Género *" id="edit-genero" value={form.genero} onChange={set("genero") as any}>
                                <option value="M">Masculino</option>
                                <option value="F">Femenino</option>
                            </SelectField>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Email" id="edit-email" type="email" value={form.email} onChange={set("email")} />
                            <Field label="Nueva Contraseña" id="edit-password" type="password" value={form.password} onChange={set("password")} placeholder="Dejar blanco para no cambiar" minLength={8} />
                        </div>

                        {user.rol === "admin" && (
                            <>
                                <SelectField label="Rol" id="edit-rol" value={form.rol} onChange={set("rol") as any}>
                                    <option value="operador">Operador</option>
                                    <option value="admin_linea">Admin de línea</option>
                                    <option value="admin">Administrador Global</option>
                                </SelectField>
                                <SelectField label="Línea Asignada" id="edit-linea" value={form.linea} onChange={set("linea") as any}>
                                    <option value="">-- Seleccione una línea --</option>
                                    {lineas.map(l => (
                                        <option key={l._id} value={l._id}>{l.name}</option>
                                    ))}
                                    {lineas.length === 0 && <option value={form.linea}>{operador.linea?.name || "Sin línea"}</option>}
                                </SelectField>
                            </>
                        )}
                        {error && <p className="text-xs text-red-400">{error}</p>}

                        <div className="flex gap-2 pt-4 mt-2 border-t border-white/5">
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={delLoading}
                                className="px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer disabled:opacity-50"
                                style={{ color: "#ef4444", borderColor: "#ef444444", backgroundColor: "#ef444415" }}
                            >
                                {delLoading ? "Eliminando..." : "Eliminar"}
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
                                disabled={loading}
                                className="flex-1 py-2.5 rounded-lg font-semibold text-sm transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ backgroundColor: C.brightGold, color: C.onyx }}
                            >
                                {loading ? "Guardando..." : "Guardar Cambios"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

// Helpers
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

// ─── Modal: Crear Operador ───────────────────────────────────────────────────
function CreateOperadorModal({ lineas, user, onClose, onSuccess }: {
    lineas: Linea[];
    user: JWTPayload;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [form, setForm] = useState({
        nombre: "",
        apellido: "",
        username: "",
        password: "",
        email: "",
        rol: user.rol === "admin" ? "operador" : "operador",
        linea: user.rol === "admin_linea" ? user.linea : (lineas[0]?._id || ""),
        genero: "M",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        
        if (form.password.length < 8) {
            setError("La contraseña debe tener al menos 8 caracteres");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                ...form,
                // Si es admin_linea, forzar linea a la suya
                linea: user.rol === "admin_linea" ? user.linea : form.linea,
                rol: user.rol === "admin_linea" ? "operador" : form.rol,
            };

            const res = await fetch(`/api/admin/operadores`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            onSuccess();
        } catch (err: any) {
            setError(err.message || "Error al crear operador.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden" style={{ backgroundColor: C.jetBlack }}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <h2 className="font-semibold text-base" style={{ color: C.platinum }}>Crear Nuevo Operador</h2>
                    <button onClick={onClose} type="button" className="text-xl leading-none opacity-50 hover:opacity-100 transition-opacity cursor-pointer" style={{ color: C.platinum }}>✕</button>
                </div>
                <div className="p-6">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Nombre" id="create-nombre" value={form.nombre} onChange={set("nombre")} required />
                            <Field label="Apellido" id="create-apellido" value={form.apellido} onChange={set("apellido")} required />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Nombre de Usuario" id="create-username" value={form.username} onChange={set("username")} required />
                            <SelectField label="Género *" id="create-genero" value={form.genero} onChange={set("genero") as any}>
                                <option value="M">Masculino</option>
                                <option value="F">Femenino</option>
                            </SelectField>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Contraseña (mínimo 8)" id="create-password" type="password" value={form.password} onChange={set("password")} required minLength={8} />
                            <Field label="Email (opcional)" id="create-email" type="email" value={form.email} onChange={set("email")} />
                        </div>

                        {user.rol === "admin" && (
                            <>
                                <SelectField label="Rol" id="create-rol" value={form.rol} onChange={set("rol") as any}>
                                    <option value="operador">Operador estándar</option>
                                    <option value="admin_linea">Administrador de línea</option>
                                    <option value="admin">Administrador Global</option>
                                </SelectField>
                                <SelectField label="Línea Asignada" id="create-linea" value={form.linea} onChange={set("linea") as any} required>
                                    <option value="">-- Seleccione una línea --</option>
                                    {lineas.map(l => (
                                        <option key={l._id} value={l._id}>{l.name}</option>
                                    ))}
                                </SelectField>
                            </>
                        )}
                        
                        {error && <p className="text-xs text-red-400">{error}</p>}

                        <div className="flex gap-2 pt-4 mt-2 border-t border-white/5">
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
                                disabled={loading || !form.username || !form.password}
                                className="flex-1 py-2.5 rounded-lg font-semibold text-sm transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ backgroundColor: C.brightGold, color: C.onyx }}
                            >
                                {loading ? "Creando..." : "Crear Operador"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
