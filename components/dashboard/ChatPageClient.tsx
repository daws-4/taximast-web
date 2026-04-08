"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { JWTPayload } from "@/lib/auth";
import { getSocket, SOCKET_EVENTS, CLIENT_EVENTS } from "@/lib/socket";
import AudioRecorder from "./AudioRecorder";

// ─── Paleta ───────────────────────────────────────────────────────────────────
const C = {
    onyx: "#0b0c0c",
    jetBlack: "#2a2e34",
    platinum: "#e9eaec",
    brightGold: "#fbe134",
    saffron: "#e4b61a",
} as const;

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Sticker {
    id: string;
    nombre: string;
    emoji: string;
    url: string;
}

interface ChatSummary {
    _id: string;
    linea?: { _id: string; name: string };
    operador?: { nombre: string; apellido: string };
    cliente_phone: string;
    cliente_nombre?: string;
    estado: "pendiente" | "bot_atendiendo" | "esperando_operador" | "en_atencion" | "cerrado";
    ultimoMensaje: string;
    tipo_chat?: "cliente" | "conductor";
    conductor?: {
        _id: string;
        nombre: string;
        telefono: string;
        unidad?: string;
        foto_identificacion?: string;
    };
}

interface Message {
    _id: string;
    origen: "cliente" | "operador" | "sistema";
    texto: string;
    timestamp: string;
    estado?: "pendiente" | "enviado" | "entregado" | "leido" | "fallido";
    tipo?: "text" | "image" | "audio" | "video" | "document" | "location" | "template" | string;
    media_url?: string;
}

interface ChatDetail extends ChatSummary {
    mensajes: Message[];
}

// ─── Helpers de estilo ────────────────────────────────────────────────────────
const ESTADO_COLOR: Record<string, string> = {
    pendiente: "#fbe134",
    bot_atendiendo: "#60a5fa",
    esperando_operador: "#f97316",
    en_atencion: "#4ade80",
    cerrado: "#94a3b8",
};

const ESTADO_LABEL: Record<string, string> = {
    pendiente: "Pendiente",
    bot_atendiendo: "Bot atendiendo",
    esperando_operador: "Esperando operador",
    en_atencion: "En atención",
    cerrado: "Cerrado",
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
    const label = ESTADO_LABEL[estado] ?? estado;
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
    const displayName = chat.tipo_chat === "conductor" && chat.conductor?.nombre
        ? chat.conductor.nombre
        : (chat.cliente_nombre || chat.cliente_phone);
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
                    className="text-sm font-semibold truncate max-w-[140px] flex items-center gap-1.5"
                    style={{ color: selected ? C.brightGold : C.platinum }}
                >
                    {chat.tipo_chat === "conductor" && <span className="text-xs shrink-0" title="Chófer">🚕</span>}
                    <span className="truncate">{displayName}</span>
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

// ─── Componentes de Estado de Mensaje ─────────────────────────────────────────
function MessageStatusIcon({ isClient, estado }: { isClient: boolean, estado?: string }) {
    if (isClient || !estado) return null;
    
    // Iconos simulan los ticks de WhatsApp
    if (estado === "pendiente") return <span className="text-[10px]" style={{ color: `${C.brightGold}55` }}>🕒</span>;
    if (estado === "enviado") return <span className="text-[10px]" style={{ color: `${C.brightGold}77` }}>✓</span>;
    if (estado === "entregado") return <span className="text-[10px]" style={{ color: `${C.brightGold}77` }}>✓✓</span>;
    if (estado === "leido") return <span className="text-[10px]" style={{ color: "#4ade80" }}>✓✓</span>;
    if (estado === "fallido") return <span className="text-[10px]" style={{ color: "#ef4444" }}>!</span>;
    return null;
}

// ─── Burbuja de mensaje ───────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
    const isClient = msg.origen === "cliente";
    const isSistema = msg.origen === "sistema";
    const isThinking = msg.tipo === "ai_thinking";

    // Pensamiento interno de la IA — solo visible para operadores
    if (isThinking) {
        return (
            <details className="my-2 mx-auto max-w-[90%]">
                <summary
                    className="text-[11px] cursor-pointer select-none flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
                    style={{ color: `${C.platinum}55` }}
                >
                    <span>🧠</span>
                    <span className="font-medium">Pensamiento de la IA</span>
                    <span className="text-[9px] ml-auto" style={{ color: `${C.platinum}33` }}>{formatTime(msg.timestamp)}</span>
                </summary>
                <div
                    className="mt-1 px-3 py-2 rounded-lg text-xs leading-relaxed whitespace-pre-wrap border-l-2"
                    style={{
                        color: `${C.platinum}66`,
                        backgroundColor: `${C.platinum}05`,
                        borderColor: `${C.platinum}15`,
                        fontStyle: "italic",
                    }}
                >
                    {msg.texto}
                </div>
            </details>
        );
    }

    // Mensajes de la IA (sistema) — se muestran como burbujas de chat completas
    if (isSistema) {
        const isSystemMedia = ["image", "video", "audio", "document", "location", "sticker", "voice"].includes(msg.tipo ?? "");
        
        return (
            <div className="flex justify-end mb-1 group">
                <div
                    className="max-w-[85%] sm:max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm relative"
                    style={{
                        backgroundColor: "#60a5fa18",
                        color: "#93c5fd",
                        borderBottomRightRadius: "4px",
                        border: "1px solid #60a5fa25",
                    }}
                >
                    <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs">🤖</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#60a5fa88" }}>
                            Asistente IA
                        </span>
                    </div>

                    {isSystemMedia && (
                        <div className={`mb-2 rounded-lg overflow-hidden flex items-center justify-center relative ${msg.tipo === 'audio' || msg.tipo === 'voice' ? 'w-full' : (msg.tipo === 'sticker' ? 'bg-transparent border-none' : 'bg-black/20 min-h-[120px] min-w-[120px]')}`}>
                            {msg.tipo === "image" || msg.tipo === "sticker" ? (
                                msg.media_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={msg.media_url} alt={msg.tipo} className={`max-w-full max-h-[300px] object-contain ${msg.tipo === 'sticker' ? 'bg-transparent' : 'rounded-lg'}`} />
                                ) : (
                                    <span className="text-xl">{msg.tipo === 'sticker' ? '👽' : '📷'}</span>
                                )
                            ) : null}
                        </div>
                    )}

                    <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.texto}</p>
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                        <p className="text-[10px]" style={{ color: "#60a5fa55" }}>
                            {formatTime(msg.timestamp)}
                        </p>
                        <MessageStatusIcon isClient={false} estado={msg.estado} />
                    </div>
                </div>
            </div>
        );
    }

    const isMedia = ["image", "video", "audio", "document", "location", "sticker", "voice"].includes(msg.tipo ?? "");

    return (
        <div className={`flex ${isClient ? "justify-start" : "justify-end"} mb-1 group`}>
            <div
                className="max-w-[85%] sm:max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm relative"
                style={{
                    backgroundColor: isClient ? `${C.jetBlack}` : `${C.brightGold}22`,
                    color: isClient ? C.platinum : C.brightGold,
                    borderBottomLeftRadius: isClient ? "4px" : "16px",
                    borderBottomRightRadius: !isClient ? "4px" : "16px",
                    border: `1px solid ${isClient ? `${C.platinum}10` : `${C.brightGold}33`}`,
                }}
            >
                {/* Multimedia Rendering Proxy */}
                {isMedia && (
                    <div className={`mb-2 rounded-lg overflow-hidden flex items-center justify-center relative ${msg.tipo === 'audio' || msg.tipo === 'voice' ? 'w-full' : (msg.tipo === 'sticker' ? 'bg-transparent border-none outline-none shadow-none min-h-[80px]' : 'bg-black/20 min-h-[120px] min-w-[120px]')}`}>
                        {msg.tipo === "image" || msg.tipo === "sticker" ? (
                            msg.media_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={msg.media_url} alt={msg.tipo} className={`max-w-full max-h-[300px] object-contain ${msg.tipo === 'sticker' ? 'bg-transparent' : 'rounded-lg'}`} />
                            ) : (
                                <span className="text-xl">{msg.tipo === 'sticker' ? '👽' : '📷'}</span>
                            )
                        ) : msg.tipo === "video" ? (
                            msg.media_url ? (
                                <video src={msg.media_url} controls className="max-w-full max-h-[300px] rounded-lg" />
                            ) : (
                                <span className="text-xl">🎥</span>
                            )
                        ) : msg.tipo === "audio" || msg.tipo === "voice" ? (
                            msg.media_url ? (
                                <audio src={msg.media_url} controls className="w-full max-w-[250px] h-10" />
                            ) : (
                                <span className="text-xl">🎵</span>
                            )
                        ) : msg.tipo === "location" ? (
                            <span className="text-xl">📍</span>
                        ) : (
                            <div className="flex flex-col items-center">
                                <span className="text-xl mb-1">📄</span>
                                {msg.media_url && <a href={msg.media_url} download className="text-xs hover:underline text-blue-400 mt-1">Descargar</a>}
                            </div>
                        )}
                        {(!["audio", "voice", "sticker"].includes(msg.tipo ?? "")) && <span className="absolute bottom-2 right-2 text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded shadow-sm" style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: C.platinum }}>{msg.tipo}</span>}
                    </div>
                )}

                {msg.texto && <p className="leading-relaxed whitespace-pre-wrap break-words mt-1">{msg.texto}</p>}
                
                <div
                    className="flex items-center justify-end gap-1.5 mt-1"
                >
                    <p className="text-[10px]" style={{ color: isClient ? `${C.platinum}44` : `${C.brightGold}77` }}>
                        {formatTime(msg.timestamp)}
                    </p>
                    <MessageStatusIcon isClient={isClient} estado={msg.estado} />
                </div>
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
    const [attachment, setAttachment] = useState<File | null>(null);
    const [sending, setSending] = useState(false);
    const [recording, setRecording] = useState(false);
    const [showStickers, setShowStickers] = useState(false);
    const [stickersList, setStickersList] = useState<Sticker[]>([]);
    const bottomRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const optimisticUrls = useRef<Record<string, string>>({}); // Maps our generated UUIDs to blobUrls

    useEffect(() => {
        return () => {
            // Revoke blobs on unmount
            Object.values(optimisticUrls.current).forEach(url => URL.revokeObjectURL(url));
        };
    }, []);

    useEffect(() => {
        fetch("/api/stickers").then(res => res.json()).then(data => {
            if (data.success) setStickersList(data.data);
        }).catch(err => console.error(err));
    }, []);

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

        const handleNuevoMensaje = (payload: { chatId: string; mensaje: Message }) => {
            if (payload.chatId === chatId) {
                setChat((prev) => {
                    if (!prev) return prev;
                    
                    // Replace optimistic message if it exists (assuming wa_message_id is used or just check for existence)
                    const existingOptimistic = prev.mensajes.findIndex(m => 
                        m.origen === payload.mensaje.origen && 
                        m.texto === payload.mensaje.texto &&
                        m.tipo === payload.mensaje.tipo &&
                        m.estado === "pendiente" &&
                        Math.abs(new Date(m.timestamp).getTime() - new Date(payload.mensaje.timestamp).getTime()) < 5000
                    );

                    let newMensajes = [...prev.mensajes];
                    
                    if (existingOptimistic !== -1) {
                        const optId = prev.mensajes[existingOptimistic]._id;
                        // We found our optimistic message, replace it with the real one from server
                        newMensajes[existingOptimistic] = payload.mensaje;
                        // We do NOT revoke the blob URL immediately to avoid flickering, let it stay in map
                    } else {
                        const alreadyExists = prev.mensajes.some((m) => m._id === payload.mensaje._id);
                        if (alreadyExists) return prev;
                        newMensajes.push(payload.mensaje);
                    }

                    return { ...prev, mensajes: newMensajes };
                });
            }
        };

        const handleMensajeEstado = (payload: { chatId: string; mensajeId: string; estado: string }) => {
            if (payload.chatId === chatId) {
                setChat((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        mensajes: prev.mensajes.map((m) =>
                            m._id === payload.mensajeId ? { ...m, estado: payload.estado as any } : m
                        )
                    };
                });
            }
        };

        const handleEstadoCambiado = (payload: { chatId: string; estado: string }) => {
            if (payload.chatId === chatId) {
                setChat((prev) => {
                    if (!prev) return prev;
                    return { ...prev, estado: payload.estado as any };
                });
            }
        };

        socket.on(SOCKET_EVENTS.NUEVO_MENSAJE, handleNuevoMensaje);
        socket.on(SOCKET_EVENTS.MENSAJE_ESTADO, handleMensajeEstado);
        socket.on(SOCKET_EVENTS.ESTADO_CAMBIADO, handleEstadoCambiado);

        return () => {
            socket.emit(CLIENT_EVENTS.LEAVE_CHAT, chatId);
            socket.off(SOCKET_EVENTS.NUEVO_MENSAJE, handleNuevoMensaje);
            socket.off(SOCKET_EVENTS.MENSAJE_ESTADO, handleMensajeEstado);
            socket.off(SOCKET_EVENTS.ESTADO_CAMBIADO, handleEstadoCambiado);
        };
    }, [chatId, loadChat]);

    // Auto-scroll al último mensaje
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chat?.mensajes.length]);

    async function handleSend(e?: React.FormEvent, directFile?: File, directMsgType?: string) {
        if (e) e.preventDefault();
        
        const currentAttachment = directFile || attachment;
        const textToSend = texto.trim();
        
        if ((!textToSend && !currentAttachment) || !chat) return;
        
        setSending(true);
        if (!directFile) {
            setTexto("");
            setAttachment(null);
            setShowStickers(false);
        }

        let mediaId = undefined;
        let msgType = directMsgType || "text";
        let optimisticUrl = "";

        if (currentAttachment) {
            if (!directMsgType) {
                if (currentAttachment.type.startsWith("image/")) msgType = "image";
                else if (currentAttachment.type.startsWith("video/")) msgType = "video";
                else if (currentAttachment.type.startsWith("audio/")) msgType = "audio";
                else msgType = "document";
            }
            
            // Generate optimistic UI url
            optimisticUrl = URL.createObjectURL(currentAttachment);
            const uuid = Math.random().toString(36).substring(7);
            optimisticUrls.current[uuid] = optimisticUrl;

            // Insert Optimistic Message
            const optimisticMsg: Message = {
                _id: uuid,
                origen: "operador",
                texto: msgType !== "audio" && msgType !== "sticker" ? textToSend : `[${msgType}]`,
                timestamp: new Date().toISOString(),
                estado: "pendiente",
                tipo: msgType,
                media_url: optimisticUrl
            };
            
            setChat(prev => {
                if (!prev) return prev;
                return { ...prev, mensajes: [...prev.mensajes, optimisticMsg] };
            });
        }

        try {
            if (currentAttachment) {
                // Subir el archivo temporalmente a Meta CDN
                const formData = new FormData();
                formData.append("file", currentAttachment);
                // Si la línea es un objeto popularo, tomar su ._id, si es String, directo.
                const lineaIdStr = typeof chat.linea === 'object' && chat.linea ? (chat.linea as any)._id : chat.linea;
                formData.append("lineaId", lineaIdStr);

                const uploadRes = await fetch("/api/whatsapp/media/upload", {
                    method: "POST",
                    body: formData,
                });
                
                const uploadData = await uploadRes.json();
                if (!uploadData.success) {
                    throw new Error(uploadData.error || "Error al subir adjunto");
                }
                mediaId = uploadData.mediaId;
            }

            // Despachar el mensaje a través de nuestra API Node
            await fetch("/api/whatsapp/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: chat.cliente_phone,
                    message: mediaId || textToSend,
                    caption: mediaId ? textToSend : undefined,
                    type: msgType,
                    chatId: chat._id,
                }),
            });
        } catch(error) {
            console.error("Error sending message:", error);
            if (!directFile) {
                setTexto(textToSend); // Restore inputs
                setAttachment(currentAttachment);
            }
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
                    {chat.tipo_chat === "conductor" && chat.conductor?.foto_identificacion ? (
                        <div className="w-9 h-9 rounded-full overflow-hidden border shrink-0" style={{ borderColor: `${C.brightGold}44` }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={chat.conductor.foto_identificacion} alt={chat.conductor.nombre} className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div
                            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                            style={{ backgroundColor: `${C.brightGold}22`, color: C.brightGold }}
                        >
                            {(chat.tipo_chat === "conductor" && chat.conductor?.nombre ? chat.conductor.nombre : (chat.cliente_nombre || chat.cliente_phone)).charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold truncate max-w-[180px] sm:max-w-xs" style={{ color: C.platinum }}>
                                {chat.tipo_chat === "conductor" && chat.conductor ? chat.conductor.nombre : (chat.cliente_nombre || chat.cliente_phone)}
                            </p>
                            {chat.tipo_chat === "conductor" && (
                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded shadow-sm shrink-0 hidden sm:inline-block" style={{ backgroundColor: `${C.brightGold}22`, color: C.brightGold }}>
                                    Chófer
                                </span>
                            )}
                            {chat.tipo_chat === "conductor" && chat.conductor?.unidad && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border shadow-sm shrink-0 hidden sm:inline-block" style={{ backgroundColor: `${C.onyx}`, color: C.platinum, borderColor: `${C.platinum}22` }}>
                                    #{chat.conductor.unidad}
                                </span>
                            )}
                        </div>
                        <p className="text-xs" style={{ color: `${C.platinum}55` }}>
                            {chat.tipo_chat === "conductor" && chat.conductor ? chat.conductor.telefono : chat.cliente_phone}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={chat.estado}
                        onChange={async (e) => {
                            const nuevoEstado = e.target.value;
                            try {
                                const res = await fetch(`/api/chats/${chat._id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ estado: nuevoEstado }),
                                });
                                const data = await res.json();
                                if (data.ok) {
                                    setChat((prev) => prev ? { ...prev, estado: nuevoEstado as ChatDetail["estado"] } : prev);
                                }
                            } catch (err) {
                                console.error("Error cambiando estado:", err);
                            }
                        }}
                        className="text-xs px-2 py-1 rounded-lg border cursor-pointer outline-none"
                        style={{
                            backgroundColor: `${ESTADO_COLOR[chat.estado] ?? C.platinum}15`,
                            borderColor: `${ESTADO_COLOR[chat.estado] ?? C.platinum}44`,
                            color: ESTADO_COLOR[chat.estado] ?? C.platinum,
                        }}
                    >
                        <option value="pendiente">🕒 Pendiente</option>
                        <option value="bot_atendiendo">🤖 Bot atendiendo</option>
                        <option value="esperando_operador">🔔 Esperando operador</option>
                        <option value="en_atencion">✅ En atención</option>
                        <option value="cerrado">🔒 Cerrado</option>
                    </select>
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
                {chat.mensajes.map((msg, index) => (
                    <MessageBubble key={msg._id || `msg-${index}`} msg={msg} />
                ))}
                <div ref={bottomRef} />
            </div>

        {/* Panel de Stickers */}
        {showStickers && (
            <div className="px-4 py-3 border-t bg-black/40 backdrop-blur-md shrink-0 flex gap-3 overflow-x-auto" style={{ borderColor: `${C.platinum}10` }}>
                {stickersList.length === 0 ? (
                    <p className="text-xs text-center w-full" style={{ color: `${C.platinum}55` }}>No hay stickers disponibles.</p>
                ) : (
                    stickersList.map(sticker => (
                        <button
                            key={sticker.id}
                            title={sticker.nombre}
                            type="button"
                            onClick={async () => {
                                setShowStickers(false);
                                try {
                                    const res = await fetch(sticker.url);
                                    const blob = await res.blob();
                                    const file = new File([blob], "sticker.webp", { type: "image/webp" });
                                    handleSend(undefined, file, "sticker");
                                } catch (e) {
                                    console.error("Error al enviar sticker", e);
                                }
                            }}
                            className="w-16 h-16 shrink-0 transition-transform hover:scale-110 cursor-pointer"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={sticker.url} alt={sticker.nombre} className="w-full h-full object-contain drop-shadow-md" />
                        </button>
                    ))
                )}
            </div>
        )}

        {/* Input Wrapper */}
        <div className="flex flex-col border-t shrink-0" style={{ borderColor: `${C.platinum}10`, backgroundColor: `${C.onyx}cc` }}>
                
                {/* Preview de adjunto */}
                {attachment && (
                    <div className="px-4 pt-3 pb-1 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-black/30 flex items-center justify-center overflow-hidden border shrink-0" style={{ borderColor: `${C.platinum}18` }}>
                            {attachment.type.startsWith('image/') ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={URL.createObjectURL(attachment)} alt="preview" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-xl">📄</span>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm truncate font-medium" style={{ color: C.platinum }}>{attachment.name}</p>
                            <p className="text-xs" style={{ color: `${C.platinum}66` }}>{(attachment.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button onClick={() => setAttachment(null)} type="button" className="p-2 rounded-full hover:bg-white/5 cursor-pointer" style={{ color: '#ef4444' }} title="Quitar archivo">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                )}

                <form
                    onSubmit={handleSend}
                    className="flex items-end gap-2 px-4 py-3 relative"
                >
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                                setAttachment(e.target.files[0]);
                                e.target.value = ''; // reset buffer
                            }
                        }}
                    />
                    
                    {/* Botón Adjuntar */}
                    <div className="flex gap-1 shrink-0">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-3 rounded-xl transition-colors shrink-0 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                            style={{ color: `${C.platinum}88` }}
                            title="Adjuntar multimedia"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                            </svg>
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowStickers(prev => !prev)}
                            className="p-3 rounded-xl transition-colors shrink-0 flex items-center justify-center hover:bg-white/5 cursor-pointer"
                            style={{ color: showStickers ? C.brightGold : `${C.platinum}88` }}
                            title="Enviar Sticker"
                        >
                            <span className="text-xl leading-none">😊</span>
                        </button>
                    </div>

                    {recording ? (
                        <AudioRecorder 
                            onStop={(blob) => {
                                setRecording(false);
                                if (blob.size > 0) {
                                    const file = new File([blob], "audio.webm", { type: "audio/webm;codecs=opus" });
                                    handleSend(undefined, file, "audio");
                                }
                            }}
                            onCancel={() => setRecording(false)}
                        />
                    ) : (
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
                            placeholder={attachment ? "Añade un comentario..." : "Escribe un mensaje… (Enter para enviar)"}
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
                    )}
                    
                    {!recording && (
                        (texto.trim() || attachment) ? (
                            <button
                                type="submit"
                                disabled={sending}
                                className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer"
                                style={{
                                    backgroundColor: C.brightGold,
                                    color: C.onyx,
                                    opacity: sending ? 0.5 : 1,
                                }}
                            >
                                {sending ? "…" : "Enviar"}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setRecording(true)}
                                className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors shrink-0 flex items-center justify-center cursor-pointer"
                                style={{ color: C.platinum }}
                                title="Grabar audio"
                            >
                                <span className="text-xl leading-none">🎙️</span>
                            </button>
                        )
                    )}
                </form>
            </div>
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
    const [estadoFilter, setEstadoFilter] = useState<string>("");
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
        if (estadoFilter) params.set("estado", estadoFilter);
        if (search) params.set("q", search);
        try {
            const res = await fetch(`/api/chats?${params}`);
            const data = await res.json();
            if (data.ok) setChats(data.data);
        } finally {
            setLoadingList(false);
        }
    }, [lineaFilter, estadoFilter]);

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
        const handleNuevoMensajeList = (payload: { chatId: string; mensaje: Message }) => {
            setChats((prev) =>
                prev.map((c) =>
                    c._id === payload.chatId
                        ? { ...c, ultimoMensaje: payload.mensaje.timestamp }
                        : c
                )
            );
        };

        // Nueva conversación → agregar al top de la lista
        const handleNuevoChat = (newChat: ChatSummary) => {
            setChats((prev) => [newChat, ...prev]);
        };

        // Estado de un chat cambió
        const handleEstadoCambiadoList = (payload: { chatId: string; estado: string }) => {
            console.log("[ChatPageClient] Recibido socket ESTADO_CAMBIADO:", payload);
            setChats((prev) =>
                prev.map((c) =>
                    c._id === payload.chatId ? { ...c, estado: payload.estado as ChatSummary["estado"] } : c
                )
            );
        };

        // Chat eliminado → quitarlo de la lista
        const handleChatEliminado = (payload: { chatId: string }) => {
            setChats((prev) => prev.filter((c) => c._id !== payload.chatId));
            setSelectedId((prev) => (prev === payload.chatId ? null : prev));
        };

        socket.on(SOCKET_EVENTS.NUEVO_MENSAJE, handleNuevoMensajeList);
        socket.on(SOCKET_EVENTS.NUEVO_CHAT, handleNuevoChat);
        socket.on(SOCKET_EVENTS.ESTADO_CAMBIADO, handleEstadoCambiadoList);
        socket.on(SOCKET_EVENTS.CHAT_ELIMINADO, handleChatEliminado);

        return () => {
            socket.off(SOCKET_EVENTS.NUEVO_MENSAJE, handleNuevoMensajeList);
            socket.off(SOCKET_EVENTS.NUEVO_CHAT, handleNuevoChat);
            socket.off(SOCKET_EVENTS.ESTADO_CAMBIADO, handleEstadoCambiadoList);
            socket.off(SOCKET_EVENTS.CHAT_ELIMINADO, handleChatEliminado);
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

                        {/* Filtro de Estado (Pendientes, Abiertos, Cerrados) */}
                        <select
                            value={estadoFilter}
                            onChange={(e) => {
                                setEstadoFilter(e.target.value);
                            }}
                            className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                            style={{
                                backgroundColor: C.jetBlack,
                                borderColor: `${C.platinum}22`,
                                color: estadoFilter ? C.platinum : `${C.platinum}66`,
                            }}
                        >
                            <option value="">Todos los chats</option>
                            <option value="pendiente">🕒 Pendientes</option>
                            <option value="bot_atendiendo">🤖 Bot atendiendo</option>
                            <option value="esperando_operador">🔔 Esperando operador</option>
                            <option value="en_atencion">✅ En atención</option>
                            <option value="cerrado">🔒 Cerrados</option>
                        </select>

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
