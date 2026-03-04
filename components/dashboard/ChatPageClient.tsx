"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { JWTPayload } from "@/lib/auth";
import { getSocket, SOCKET_EVENTS, CLIENT_EVENTS } from "@/lib/socket";

// ─── Paleta ───────────────────────────────────────────────────────────────────
const C = {
    onyx: "#0b0c0c",
    jetBlack: "#2a2e34",
    platinum: "#e9eaec",
    brightGold: "#fbe134",
    saffron: "#e4b61a",
} as const;

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ChatSummary {
    _id: string;
    linea?: { _id: string; name: string };
    operador?: { nombre: string; apellido: string };
    cliente_phone: string;
    cliente_nombre?: string;
    estado: "abierto" | "cerrado" | "pendiente";
    ultimoMensaje: string;
}

interface Message {
    _id: string;
    origen: "cliente" | "operador" | "sistema";
    texto: string;
    timestamp: string;
    leido: boolean;
}

interface ChatDetail extends ChatSummary {
    mensajes: Message[];
}

// ─── Helpers de estilo ────────────────────────────────────────────────────────
const ESTADO_COLOR: Record<string, string> = {
    abierto: "#4ade80",
    pendiente: "#fbe134",
    cerrado: "#94a3b8",
};

function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Hoy";
    return d.toLocaleDateString("es-VE", { day: "numeric", month: "short" });
}

// ─── Chip de estado ──────────────────────────────────────────────────────────
function EstadoChip({ estado }: { estado: string }) {
    const color = ESTADO_COLOR[estado] ?? C.platinum;
    const label = { abierto: "Abierto", pendiente: "Pendiente", cerrado: "Cerrado" }[estado] ?? estado;
    return (
        <span
            className="text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: `${color}20`, color }}
        >
            {label}
        </span>
    );
}

// ─── Item de chat en el sidebar ───────────────────────────────────────────────
function ChatListItem({
    chat,
    selected,
    onClick,
    showLinea,
}: {
    chat: ChatSummary;
    selected: boolean;
    onClick: () => void;
    showLinea: boolean;
}) {
    const displayName = chat.cliente_nombre || chat.cliente_phone;
    return (
        <button
            onClick={onClick}
            className="w-full text-left px-4 py-3 flex flex-col gap-1 transition-colors border-b cursor-pointer"
            style={{
                borderColor: `${C.platinum}08`,
                backgroundColor: selected ? `${C.brightGold}10` : "transparent",
                borderLeft: selected ? `3px solid ${C.brightGold}` : "3px solid transparent",
            }}
        >
            <div className="flex items-center justify-between gap-2">
                <span
                    className="text-sm font-semibold truncate max-w-[140px]"
                    style={{ color: selected ? C.brightGold : C.platinum }}
                >
                    {displayName}
                </span>
                <span className="text-xs shrink-0" style={{ color: `${C.platinum}44` }}>
                    {formatDate(chat.ultimoMensaje)}
                </span>
            </div>
            <div className="flex items-center justify-between gap-2">
                {showLinea && chat.linea && (
                    <span className="text-xs truncate" style={{ color: C.saffron }}>
                        {chat.linea.name}
                    </span>
                )}
                <EstadoChip estado={chat.estado} />
            </div>
            {!showLinea && (
                <span className="text-xs" style={{ color: `${C.platinum}44` }}>
                    {chat.cliente_phone}
                </span>
            )}
        </button>
    );
}

// ─── Burbuja de mensaje ───────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
    const isClient = msg.origen === "cliente";
    const isSistema = msg.origen === "sistema";

    if (isSistema) {
        return (
            <div className="flex justify-center">
                <span
                    className="text-xs px-3 py-1 rounded-full"
                    style={{ backgroundColor: `${C.platinum}10`, color: `${C.platinum}55` }}
                >
                    {msg.texto}
                </span>
            </div>
        );
    }

    return (
        <div className={`flex ${isClient ? "justify-start" : "justify-end"}`}>
            <div
                className="max-w-[75%] px-4 py-2.5 rounded-2xl text-sm"
                style={{
                    backgroundColor: isClient ? `${C.jetBlack}` : `${C.brightGold}22`,
                    color: isClient ? C.platinum : C.brightGold,
                    borderBottomLeftRadius: isClient ? "4px" : undefined,
                    borderBottomRightRadius: !isClient ? "4px" : undefined,
                    border: `1px solid ${isClient ? `${C.platinum}10` : `${C.brightGold}33`}`,
                }}
            >
                <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.texto}</p>
                <p
                    className="text-right mt-1 text-xs"
                    style={{ color: isClient ? `${C.platinum}44` : `${C.brightGold}77` }}
                >
                    {formatTime(msg.timestamp)}
                </p>
            </div>
        </div>
    );
}

// ─── Panel de conversación ────────────────────────────────────────────────────
function ConversationPanel({
    chatId,
    onClose,
}: {
    chatId: string;
    onClose: () => void;
}) {
    const [chat, setChat] = useState<ChatDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [texto, setTexto] = useState("");
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    const loadChat = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/chats/${chatId}`);
            const data = await res.json();
            if (data.ok) setChat(data.data);
        } finally {
            setLoading(false);
        }
    }, [chatId]);

    useEffect(() => {
        loadChat();

        // Unirse a la sala del chat para recibir mensajes en tiempo real
        const socket = getSocket();
        socket.emit(CLIENT_EVENTS.JOIN_CHAT, chatId);

        socket.on(SOCKET_EVENTS.NUEVO_MENSAJE, (payload: { chatId: string; mensaje: Message }) => {
            if (payload.chatId === chatId) {
                setChat((prev) => {
                    if (!prev) return prev;
                    // Evitar duplicados si el evento de la sala 'linea' y 'chat' llegan al mismo tiempo
                    const alreadyExists = prev.mensajes.some((m) => m._id === payload.mensaje._id);
                    if (alreadyExists) return prev;

                    return { ...prev, mensajes: [...prev.mensajes, payload.mensaje] };
                });
            }
        });

        return () => {
            socket.emit(CLIENT_EVENTS.LEAVE_CHAT, chatId);
            socket.off(SOCKET_EVENTS.NUEVO_MENSAJE);
        };
    }, [chatId, loadChat]);

    // Auto-scroll al último mensaje
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chat?.mensajes.length]);

    async function handleSend(e: React.FormEvent) {
        e.preventDefault();
        if (!texto.trim() || !chat) return;
        setSending(true);
        const textToSend = texto.trim();
        setTexto("");

        // El Webhook / Send route emitirán el evento de Socket.io una vez guradado en la BD
        // lo que actualizará el estado del chat instantáneamente sin causar duplicados visuales

        try {
            await fetch("/api/whatsapp/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: chat.cliente_phone,
                    message: textToSend,
                    type: "text",
                    chatId: chat._id,
                }),
            });
        } finally {
            setSending(false);
        }
    }

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div
                    className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: `${C.brightGold}44`, borderTopColor: C.brightGold }}
                />
            </div>
        );
    }

    if (!chat) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <p className="text-sm" style={{ color: `${C.platinum}44` }}>
                    No se pudo cargar el chat.
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* Header del chat */}
            <div
                className="flex items-center justify-between px-5 py-3 border-b shrink-0"
                style={{ borderColor: `${C.platinum}10`, backgroundColor: `${C.jetBlack}cc` }}
            >
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="md:hidden text-lg leading-none cursor-pointer"
                        style={{ color: `${C.platinum}66` }}
                    >
                        ←
                    </button>
                    <div
                        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                        style={{ backgroundColor: `${C.brightGold}22`, color: C.brightGold }}
                    >
                        {(chat.cliente_nombre || chat.cliente_phone).charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="text-sm font-semibold" style={{ color: C.platinum }}>
                            {chat.cliente_nombre || chat.cliente_phone}
                        </p>
                        {chat.cliente_nombre && (
                            <p className="text-xs" style={{ color: `${C.platinum}55` }}>
                                {chat.cliente_phone}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <EstadoChip estado={chat.estado} />
                    {chat.linea && (
                        <span className="text-xs hidden sm:block" style={{ color: C.saffron }}>
                            {chat.linea.name}
                        </span>
                    )}
                </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 min-h-0">
                {chat.mensajes.length === 0 && (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-sm" style={{ color: `${C.platinum}33` }}>
                            Sin mensajes aún
                        </p>
                    </div>
                )}
                {chat.mensajes.map((msg) => (
                    <MessageBubble key={msg._id} msg={msg} />
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form
                onSubmit={handleSend}
                className="flex items-end gap-3 px-4 py-3 border-t shrink-0"
                style={{ borderColor: `${C.platinum}10`, backgroundColor: `${C.onyx}cc` }}
            >
                <textarea
                    rows={1}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend(e as unknown as React.FormEvent);
                        }
                    }}
                    placeholder="Escribe un mensaje… (Enter para enviar)"
                    maxLength={4096}
                    className="flex-1 resize-none rounded-xl px-4 py-2.5 text-sm border outline-none transition-colors"
                    style={{
                        backgroundColor: `${C.jetBlack}`,
                        borderColor: `${C.platinum}18`,
                        color: C.platinum,
                        maxHeight: "120px",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = `${C.brightGold}44`)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = `${C.platinum}18`)}
                />
                <button
                    type="submit"
                    disabled={sending || !texto.trim()}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer"
                    style={{
                        backgroundColor: C.brightGold,
                        color: C.onyx,
                        opacity: sending || !texto.trim() ? 0.5 : 1,
                    }}
                >
                    {sending ? "…" : "Enviar"}
                </button>
            </form>
        </div>
    );
}

// ─── Estado vacío del panel derecho ──────────────────────────────────────────
function EmptyPanel() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${C.brightGold}15` }}
            >
                <svg
                    className="w-8 h-8"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={C.brightGold}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
            </div>
            <div className="text-center">
                <p className="font-semibold text-base" style={{ color: `${C.platinum}88` }}>
                    Selecciona una conversación
                </p>
                <p className="text-sm mt-1" style={{ color: `${C.platinum}44` }}>
                    Elige un chat de la lista para ver los mensajes
                </p>
            </div>
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ChatPageClient({ user }: { user: JWTPayload }) {
    const router = useRouter();
    const [chats, setChats] = useState<ChatSummary[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [lineas, setLineas] = useState<{ _id: string; name: string }[]>([]);
    const [lineaFilter, setLineaFilter] = useState<string>("");
    const [q, setQ] = useState("");
    const [loadingList, setLoadingList] = useState(true);
    const [mobileShowPanel, setMobileShowPanel] = useState(false);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isAdmin = user.rol === "admin";

    // ── Cargar lista de chats ─────────────────────────────────────────────────
    const fetchChats = useCallback(async (search?: string) => {
        setLoadingList(true);
        const params = new URLSearchParams();
        if (lineaFilter) params.set("linea", lineaFilter);
        if (search) params.set("q", search);
        try {
            const res = await fetch(`/api/chats?${params}`);
            const data = await res.json();
            if (data.ok) setChats(data.data);
        } finally {
            setLoadingList(false);
        }
    }, [lineaFilter]);

    // ── Cargar líneas (solo admin) ────────────────────────────────────────────
    const fetchLineas = useCallback(async () => {
        if (!isAdmin) return;
        const res = await fetch("/api/admin/lineas");
        const data = await res.json();
        if (data.ok) setLineas(data.data);
    }, [isAdmin]);

    useEffect(() => {
        fetchLineas();
    }, [fetchLineas]);

    useEffect(() => {
        fetchChats();
    }, [fetchChats]);

    // ── Socket.io ─────────────────────────────────────────────────────────────
    useEffect(() => {
        const socket = getSocket();

        const roomId = isAdmin ? "admin" : user.linea;
        socket.emit(CLIENT_EVENTS.JOIN_LINEA, roomId);

        // Nuevo mensaje en cualquier chat → actualizar ultimoMensaje de ese chat
        socket.on(SOCKET_EVENTS.NUEVO_MENSAJE, (payload: { chatId: string; mensaje: Message }) => {
            setChats((prev) =>
                prev.map((c) =>
                    c._id === payload.chatId
                        ? { ...c, ultimoMensaje: payload.mensaje.timestamp }
                        : c
                )
            );
        });

        // Nueva conversación → agregar al top de la lista
        socket.on(SOCKET_EVENTS.NUEVO_CHAT, (newChat: ChatSummary) => {
            setChats((prev) => [newChat, ...prev]);
        });

        // Estado de un chat cambió
        socket.on(SOCKET_EVENTS.ESTADO_CAMBIADO, (payload: { chatId: string; estado: string }) => {
            setChats((prev) =>
                prev.map((c) =>
                    c._id === payload.chatId ? { ...c, estado: payload.estado as ChatSummary["estado"] } : c
                )
            );
        });

        return () => {
            socket.off(SOCKET_EVENTS.NUEVO_MENSAJE);
            socket.off(SOCKET_EVENTS.NUEVO_CHAT);
            socket.off(SOCKET_EVENTS.ESTADO_CAMBIADO);
        };
    }, [isAdmin, user.linea]);

    // ── Búsqueda con debounce ─────────────────────────────────────────────────
    function handleSearchChange(value: string) {
        setQ(value);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => fetchChats(value), 300);
    }

    const rolLabel = { admin: "Administrador", admin_linea: "Admin de Línea", operador: "Operador" }[user.rol] ?? "—";
    const initials = user.nombre.charAt(0).toUpperCase();

    return (
        <div className="h-screen flex flex-col" style={{ background: `linear-gradient(135deg, ${C.onyx} 0%, ${C.jetBlack} 100%)` }}>

            {/* ── Topbar ─────────────────────────────────────────────────────── */}
            <header
                className="flex items-center justify-between px-5 py-3 border-b shrink-0 z-10 backdrop-blur-sm"
                style={{ borderColor: `${C.platinum}08`, backgroundColor: `${C.onyx}cc` }}
            >
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="text-xs px-2 py-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                        style={{ color: C.platinum }}
                        title="Volver al dashboard"
                    >
                        ← Dashboard
                    </button>
                    <span className="text-xl font-extrabold tracking-tight" style={{ color: C.brightGold }}>
                        Chats
                    </span>
                    <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full border"
                        style={{ color: C.saffron, borderColor: `${C.saffron}55`, backgroundColor: `${C.saffron}15` }}
                    >
                        {rolLabel}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold hidden sm:block" style={{ color: C.platinum }}>
                        {user.nombre}
                    </p>
                    <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                        style={{ backgroundColor: C.brightGold, color: C.onyx }}
                    >
                        {initials}
                    </div>
                </div>
            </header>

            {/* ── Layout principal ──────────────────────────────────────────── */}
            <div className="flex-1 flex min-h-0">

                {/* ── Sidebar ──────────────────────────────────────────────── */}
                <aside
                    className={`
                        w-full md:w-80 shrink-0 flex flex-col border-r
                        ${mobileShowPanel ? "hidden md:flex" : "flex"}
                    `}
                    style={{ borderColor: `${C.platinum}08`, backgroundColor: `${C.onyx}55` }}
                >
                    {/* Filtros */}
                    <div
                        className="px-4 py-3 flex flex-col gap-2 border-b shrink-0"
                        style={{ borderColor: `${C.platinum}08` }}
                    >
                        {/* Filtro de línea — solo admin */}
                        {isAdmin && (
                            <select
                                value={lineaFilter}
                                onChange={(e) => setLineaFilter(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                style={{
                                    backgroundColor: C.jetBlack,
                                    borderColor: `${C.platinum}22`,
                                    color: lineaFilter ? C.platinum : `${C.platinum}66`,
                                }}
                            >
                                <option value="">Todas las líneas</option>
                                {lineas.map((l) => (
                                    <option key={l._id} value={l._id}>
                                        {l.name}
                                    </option>
                                ))}
                            </select>
                        )}

                        {/* Buscador */}
                        <div className="relative">
                            <svg
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke={`${C.platinum}44`}
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                value={q}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                placeholder="Buscar por nombre o número…"
                                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border outline-none transition-colors"
                                style={{
                                    backgroundColor: C.jetBlack,
                                    borderColor: `${C.platinum}18`,
                                    color: C.platinum,
                                }}
                                onFocus={(e) => (e.currentTarget.style.borderColor = `${C.brightGold}44`)}
                                onBlur={(e) => (e.currentTarget.style.borderColor = `${C.platinum}18`)}
                            />
                        </div>
                    </div>

                    {/* Lista de chats */}
                    <div className="flex-1 overflow-y-auto">
                        {loadingList ? (
                            <div className="flex justify-center py-10">
                                <div
                                    className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
                                    style={{ borderColor: `${C.brightGold}44`, borderTopColor: C.brightGold }}
                                />
                            </div>
                        ) : chats.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-2">
                                <svg
                                    className="w-10 h-10 opacity-20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke={C.platinum}
                                    strokeWidth={1.5}
                                >
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                <p className="text-sm" style={{ color: `${C.platinum}44` }}>
                                    Sin conversaciones
                                </p>
                            </div>
                        ) : (
                            chats.map((chat) => (
                                <ChatListItem
                                    key={chat._id}
                                    chat={chat}
                                    selected={chat._id === selectedId}
                                    showLinea={isAdmin}
                                    onClick={() => {
                                        setSelectedId(chat._id);
                                        setMobileShowPanel(true);
                                    }}
                                />
                            ))
                        )}
                    </div>
                </aside>

                {/* ── Panel derecho ─────────────────────────────────────────── */}
                <main
                    className={`
                        flex-1 flex flex-col min-h-0 min-w-0
                        ${mobileShowPanel ? "flex" : "hidden md:flex"}
                    `}
                >
                    {selectedId ? (
                        <ConversationPanel
                            key={selectedId}
                            chatId={selectedId}
                            onClose={() => {
                                setMobileShowPanel(false);
                                setSelectedId(null);
                            }}
                        />
                    ) : (
                        <EmptyPanel />
                    )}
                </main>
            </div>
        </div>
    );
}
