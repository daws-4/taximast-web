"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { JWTPayload } from "@/lib/auth";

const C = {
    onyx: "#0b0c0c",
    jetBlack: "#2a2e34",
    platinum: "#e9eaec",
    brightGold: "#fbe134",
    saffron: "#e4b61a",
} as const;

interface Conductor {
    _id: string;
    nombre: string;
    cedula?: string;
    telefono?: string;
    control?: string;
    placa?: string;
    foto_identificacion?: string;
    activo: boolean;
    notas?: string;
    linea: { _id: string; name: string } | null;
}

interface Linea {
    _id: string;
    name: string;
}

interface Props {
    user: JWTPayload;
}

export default function ConductoresClient({ user }: Props) {
    const [conductores, setConductores] = useState<Conductor[]>([]);
    const [lineas, setLineas] = useState<Linea[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editConductor, setEditConductor] = useState<Conductor | null>(null);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [filterLinea, setFilterLinea] = useState("");
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

    const isReadOnly = user.rol === "operador";

    // Form fields
    const [fNombre, setFNombre] = useState("");
    const [fCedula, setFCedula] = useState("");
    const [fTelefono, setFTelefono] = useState("");
    const [fControl, setFControl] = useState("");
    const [fPlaca, setFPlaca] = useState("");
    const [fNotas, setFNotas] = useState("");
    const [fLinea, setFLinea] = useState("");
    const [fFoto, setFFoto] = useState<File | null>(null);
    const [fFotoPreview, setFFotoPreview] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [condRes, lineasRes] = await Promise.all([
                fetch("/api/admin/conductores"),
                user.rol === "admin" ? fetch("/api/admin/lineas") : Promise.resolve(null),
            ]);
            const condData = await condRes.json();
            if (condData.ok) setConductores(condData.data);

            if (lineasRes) {
                const lineasData = await lineasRes.json();
                if (lineasData.ok) setLineas(lineasData.data);
            }
        } finally {
            setLoading(false);
        }
    }, [user.rol]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const openCreate = () => {
        setEditConductor(null);
        setFNombre("");
        setFCedula("");
        setFTelefono("");
        setFControl("");
        setFPlaca("");
        setFNotas("");
        setFLinea(user.rol === "admin_linea" ? user.linea || "" : "");
        setFFoto(null);
        setFFotoPreview("");
        setModalOpen(true);
    };

    const openEdit = (c: Conductor) => {
        setEditConductor(c);
        setFNombre(c.nombre);
        setFCedula(c.cedula || "");
        setFTelefono(c.telefono || "");
        setFControl(c.control || "");
        setFPlaca(c.placa || "");
        setFNotas(c.notas || "");
        setFLinea(c.linea?._id || "");
        setFFoto(null);
        setFFotoPreview(c.foto_identificacion || "");
        setModalOpen(true);
    };

    // Comprimir imagen client-side para no exceder el límite de PocketBase (5MB)
    const compressImage = async (file: File, maxSizeMB = 4.5, maxDim = 1600): Promise<File> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let { width, height } = img;

                // Redimensionar si excede maxDim
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d")!;
                ctx.drawImage(img, 0, 0, width, height);

                // Reducir calidad progresivamente hasta estar bajo el límite
                let quality = 0.85;
                const tryCompress = () => {
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) { resolve(file); return; }
                            if (blob.size > maxSizeMB * 1024 * 1024 && quality > 0.3) {
                                quality -= 0.1;
                                tryCompress();
                            } else {
                                const compressed = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
                                    type: "image/jpeg",
                                });
                                resolve(compressed);
                            }
                        },
                        "image/jpeg",
                        quality
                    );
                };
                tryCompress();
            };
            img.onerror = () => resolve(file); // fallback al original si falla
            img.src = URL.createObjectURL(file);
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const compressed = await compressImage(file);
            setFFoto(compressed);
            setFFotoPreview(URL.createObjectURL(compressed));
        }
    };

    const handleSave = async () => {
        if (!fNombre.trim()) return;
        setSaving(true);

        try {
            // Upload foto si hay una nueva
            let fotoUrl = editConductor?.foto_identificacion || "";
            if (fFoto) {
                const formData = new FormData();
                formData.append("foto", fFoto);
                formData.append("telefono", fTelefono.trim());
                const uploadRes = await fetch("/api/admin/conductores/upload", {
                    method: "POST",
                    body: formData,
                });
                const uploadData = await uploadRes.json();
                if (uploadData.ok) fotoUrl = uploadData.data.url;
            }

            const body = {
                nombre: fNombre.trim(),
                cedula: fCedula.trim() || undefined,
                telefono: fTelefono.trim() || undefined,
                control: fControl.trim() || undefined,
                placa: fPlaca.trim() || undefined,
                notas: fNotas.trim() || undefined,
                foto_identificacion: fotoUrl || undefined,
                ...(user.rol === "admin" ? { linea: fLinea } : {}),
            };

            const url = editConductor
                ? `/api/admin/conductores/${editConductor._id}`
                : "/api/admin/conductores";

            const res = await fetch(url, {
                method: editConductor ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (data.ok) {
                setModalOpen(false);
                fetchData();
            } else {
                alert(data.error || "Error al guardar");
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar este conductor?")) return;
        const res = await fetch(`/api/admin/conductores/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.ok) fetchData();
    };

    const handleToggleActive = async (c: Conductor) => {
        await fetch(`/api/admin/conductores/${c._id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ activo: !c.activo }),
        });
        fetchData();
    };

    const filtered = conductores.filter((c) => {
        // Filtro por línea
        if (filterLinea && c.linea?._id !== filterLinea) return false;

        if (!search) return true;
        const q = search.toLowerCase();
        return (
            c.nombre.toLowerCase().includes(q) ||
            c.telefono?.includes(q) ||
            c.control?.toLowerCase().includes(q) ||
            c.placa?.toLowerCase().includes(q) ||
            c.cedula?.toLowerCase().includes(q)
        );
    }).sort((a, b) => {
        // Orden natural: maneja "1", "2", "10" correctamente en lugar de "1", "10", "2"
        const uA = a.control || "";
        const uB = b.control || "";
        return uA.localeCompare(uB, undefined, { numeric: true, sensitivity: 'base' });
    });

    return (
        <div className="min-h-screen px-4 sm:px-8 py-8" style={{ backgroundColor: C.onyx, color: C.platinum }}>
            {/* Header */}
            <div className="mb-6">
                <Link 
                    href="/dashboard" 
                    className="text-sm flex items-center gap-2 hover:opacity-80 transition-opacity"
                    style={{ color: `${C.platinum}77` }}
                >
                    ← Volver al Panel
                </Link>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: C.brightGold }}>🚕 Conductores</h1>
                    <p className="text-sm mt-1" style={{ color: `${C.platinum}77` }}>
                        Gestiona los conductores registrados en tus líneas
                    </p>
                </div>
                {!isReadOnly && (
                    <button
                        onClick={openCreate}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 cursor-pointer"
                        style={{ backgroundColor: C.brightGold, color: C.onyx }}
                    >
                        + Nuevo Conductor
                    </button>
                )}
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <input
                    type="text"
                    placeholder="Buscar por nombre, teléfono, cédula, control o placa..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full lg:w-1/4 px-4 py-2.5 rounded-xl text-sm outline-none border"
                    style={{
                        backgroundColor: `${C.jetBlack}`,
                        borderColor: `${C.platinum}15`,
                        color: C.platinum,
                    }}
                />
                
                {user.rol === "admin" && (
                    <select
                        value={filterLinea}
                        onChange={(e) => setFilterLinea(e.target.value)}
                        className="px-4 py-2.5 rounded-xl text-sm outline-none border cursor-pointer min-w-[200px]"
                        style={{
                            backgroundColor: `${C.jetBlack}`,
                            borderColor: `${C.platinum}15`,
                            color: C.platinum,
                        }}
                    >
                        <option value="">Todas las líneas</option>
                        {lineas.map(l => (
                            <option key={l._id} value={l._id}>{l.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${C.brightGold} transparent ${C.brightGold} ${C.brightGold}` }} />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20" style={{ color: `${C.platinum}44` }}>
                    <p className="text-lg">No hay conductores registrados</p>
                    <p className="text-sm mt-1">Crea uno con el botón de arriba</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: `${C.platinum}10` }}>
                    <table className="w-full text-sm">
                        <thead>
                            <tr style={{ backgroundColor: `${C.jetBlack}` }}>
                                <th className="text-left px-4 py-3 font-semibold" style={{ color: `${C.platinum}88` }}>Foto</th>
                                <th className="text-left px-4 py-3 font-semibold" style={{ color: `${C.platinum}88` }}>Nombre</th>
                                <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell" style={{ color: `${C.platinum}88` }}>Cédula</th>
                                <th className="text-left px-4 py-3 font-semibold" style={{ color: `${C.platinum}88` }}>Teléfono</th>
                                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell" style={{ color: `${C.platinum}88` }}>Control</th>
                                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell" style={{ color: `${C.platinum}88` }}>Placa</th>
                                {user.rol === "admin" && (
                                    <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell" style={{ color: `${C.platinum}88` }}>Línea</th>
                                )}
                                <th className="text-left px-4 py-3 font-semibold" style={{ color: `${C.platinum}88` }}>Estado</th>
                                {!isReadOnly && (
                                    <th className="text-right px-4 py-3 font-semibold" style={{ color: `${C.platinum}88` }}>Acciones</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((c) => (
                                <tr
                                    key={c._id}
                                    className="border-t transition-colors hover:bg-white/[0.02]"
                                    style={{ borderColor: `${C.platinum}08` }}
                                >
                                    <td className="px-4 py-3">
                                        {c.foto_identificacion ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={c.foto_identificacion}
                                                alt={c.nombre}
                                                className="w-10 h-10 rounded-lg object-cover border cursor-pointer hover:opacity-80 transition-opacity"
                                                style={{ borderColor: `${C.platinum}15` }}
                                                onClick={() => setLightboxUrl(c.foto_identificacion!)}
                                            />
                                        ) : (
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                                                style={{ backgroundColor: `${C.platinum}08` }}
                                            >
                                                👤
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 font-medium">{c.nombre}</td>
                                    <td className="px-4 py-3 hidden sm:table-cell" style={{ color: `${C.platinum}66` }}>{c.cedula || "—"}</td>
                                    <td className="px-4 py-3" style={{ color: `${C.platinum}88` }}>{c.telefono || "—"}</td>
                                    <td className="px-4 py-3 hidden md:table-cell" style={{ color: C.saffron }}>{c.control || "—"}</td>
                                    <td className="px-4 py-3 hidden md:table-cell" style={{ color: `${C.platinum}66` }}>{c.placa || "—"}</td>
                                    {user.rol === "admin" && (
                                        <td className="px-4 py-3 hidden lg:table-cell" style={{ color: `${C.platinum}66` }}>{c.linea?.name || "—"}</td>
                                    )}
                                    <td className="px-4 py-3">
                                        {isReadOnly ? (
                                            <span
                                                className="text-xs px-2 py-1 rounded-full font-medium"
                                                style={{
                                                    backgroundColor: c.activo ? "#4ade8022" : "#ef444422",
                                                    color: c.activo ? "#4ade80" : "#ef4444",
                                                }}
                                            >
                                                {c.activo ? "Activo" : "Inactivo"}
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => handleToggleActive(c)}
                                                className="text-xs px-2 py-1 rounded-full font-medium cursor-pointer transition-opacity hover:opacity-80"
                                                style={{
                                                    backgroundColor: c.activo ? "#4ade8022" : "#ef444422",
                                                    color: c.activo ? "#4ade80" : "#ef4444",
                                                }}
                                            >
                                                {c.activo ? "Activo" : "Inactivo"}
                                            </button>
                                        )}
                                    </td>
                                    {!isReadOnly && (
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openEdit(c)}
                                                    className="text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors hover:bg-white/5"
                                                    style={{ color: C.brightGold }}
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(c._id)}
                                                    className="text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors hover:bg-red-500/10"
                                                    style={{ color: "#ef4444" }}
                                                >
                                                    Eliminar
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                    <div
                        className="w-full max-w-lg rounded-2xl border p-6 max-h-[90vh] overflow-y-auto"
                        style={{ backgroundColor: C.jetBlack, borderColor: `${C.platinum}15` }}
                    >
                        <h2 className="text-lg font-bold mb-5" style={{ color: C.brightGold }}>
                            {editConductor ? "Editar Conductor" : "Nuevo Conductor"}
                        </h2>

                        <div className="space-y-4">
                            {/* Foto de identificación */}
                            <div>
                                <label className="text-xs font-medium mb-1 block" style={{ color: `${C.platinum}88` }}>
                                    Foto de Identificación
                                </label>
                                <div className="flex items-center gap-4">
                                    {fFotoPreview ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={fFotoPreview}
                                            alt="Preview"
                                            className="w-20 h-20 rounded-xl object-cover border cursor-pointer hover:opacity-80 transition-opacity"
                                            style={{ borderColor: `${C.platinum}15` }}
                                            onClick={() => setLightboxUrl(fFotoPreview)}
                                        />
                                    ) : (
                                        <div
                                            className="w-20 h-20 rounded-xl flex items-center justify-center text-2xl"
                                            style={{ backgroundColor: `${C.platinum}08`, border: `1px dashed ${C.platinum}22` }}
                                        >
                                            📷
                                        </div>
                                    )}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="text-xs px-3 py-1.5 rounded-lg border cursor-pointer transition-colors hover:bg-white/5"
                                        style={{ borderColor: `${C.platinum}22`, color: C.platinum }}
                                    >
                                        {fFotoPreview ? "Cambiar foto" : "Subir foto"}
                                    </button>
                                </div>
                            </div>

                            {/* Nombre */}
                            <div>
                                <label className="text-xs font-medium mb-1 block" style={{ color: `${C.platinum}88` }}>
                                    Nombre completo *
                                </label>
                                <input
                                    value={fNombre}
                                    onChange={(e) => setFNombre(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                                    style={{ backgroundColor: `${C.onyx}`, borderColor: `${C.platinum}15`, color: C.platinum }}
                                    placeholder="Ej: Juan Pérez"
                                />
                            </div>

                            {/* Cédula */}
                            <div>
                                <label className="text-xs font-medium mb-1 block" style={{ color: `${C.platinum}88` }}>
                                    Cédula
                                </label>
                                <input
                                    value={fCedula}
                                    onChange={(e) => setFCedula(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                                    style={{ backgroundColor: `${C.onyx}`, borderColor: `${C.platinum}15`, color: C.platinum }}
                                    placeholder="Ej: V-12345678"
                                />
                            </div>

                            {/* Teléfono */}
                            <div>
                                <label className="text-xs font-medium mb-1 block" style={{ color: `${C.platinum}88` }}>
                                    Teléfono (WhatsApp)
                                </label>
                                <input
                                    value={fTelefono}
                                    onChange={(e) => setFTelefono(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                                    style={{ backgroundColor: `${C.onyx}`, borderColor: `${C.platinum}15`, color: C.platinum }}
                                    placeholder="Ej: 584121234567 (opcional)"
                                />
                            </div>

                            {/* Control */}
                            <div>
                                <label className="text-xs font-medium mb-1 block" style={{ color: `${C.platinum}88` }}>
                                    Número de Control
                                </label>
                                <input
                                    value={fControl}
                                    onChange={(e) => setFControl(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                                    style={{ backgroundColor: `${C.onyx}`, borderColor: `${C.platinum}15`, color: C.platinum }}
                                    placeholder="Ej: 015"
                                />
                            </div>

                            {/* Placa */}
                            <div>
                                <label className="text-xs font-medium mb-1 block" style={{ color: `${C.platinum}88` }}>
                                    Placa del Vehículo
                                </label>
                                <input
                                    value={fPlaca}
                                    onChange={(e) => setFPlaca(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                                    style={{ backgroundColor: `${C.onyx}`, borderColor: `${C.platinum}15`, color: C.platinum }}
                                    placeholder="Ej: ABC-123"
                                />
                            </div>

                            {/* Línea (solo admin global) */}
                            {user.rol === "admin" && (
                                <div>
                                    <label className="text-xs font-medium mb-1 block" style={{ color: `${C.platinum}88` }}>
                                        Línea *
                                    </label>
                                    <select
                                        value={fLinea}
                                        onChange={(e) => setFLinea(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg text-sm outline-none border cursor-pointer"
                                        style={{ backgroundColor: `${C.onyx}`, borderColor: `${C.platinum}15`, color: C.platinum }}
                                    >
                                        <option value="">Seleccionar línea</option>
                                        {lineas.map((l) => (
                                            <option key={l._id} value={l._id}>{l.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Notas */}
                            <div>
                                <label className="text-xs font-medium mb-1 block" style={{ color: `${C.platinum}88` }}>
                                    Notas internas
                                </label>
                                <textarea
                                    value={fNotas}
                                    onChange={(e) => setFNotas(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 rounded-lg text-sm outline-none border resize-none"
                                    style={{ backgroundColor: `${C.onyx}`, borderColor: `${C.platinum}15`, color: C.platinum }}
                                    placeholder="Notas opcionales sobre este conductor..."
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setModalOpen(false)}
                                className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors hover:bg-white/5"
                                style={{ color: `${C.platinum}88` }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !fNombre.trim()}
                                className="px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{ backgroundColor: C.brightGold, color: C.onyx }}
                            >
                                {saving ? "Guardando..." : editConductor ? "Guardar cambios" : "Crear conductor"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox para expandir fotos */}
            {lightboxUrl && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md cursor-pointer"
                    onClick={() => setLightboxUrl(null)}
                >
                    <div className="relative max-w-[90vw] max-h-[90vh]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={lightboxUrl}
                            alt="Foto de identificación"
                            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
                        />
                        <button
                            onClick={() => setLightboxUrl(null)}
                            className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold cursor-pointer transition-transform hover:scale-110"
                            style={{ backgroundColor: C.jetBlack, color: C.platinum, border: `1px solid ${C.platinum}22` }}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
