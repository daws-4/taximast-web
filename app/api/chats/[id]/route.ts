import { NextRequest, NextResponse } from "next/server";
import { withAuth, getUserFromRequest } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import ChatsModel from "@/models/Chats";

// GET /api/chats/[id] — Detalle completo con mensajes
async function getHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });

    const { id } = await params;

    await connectDB();

    try {
        const chat = await ChatsModel.findById(id)
            .populate("linea", "name")
            .populate("operador", "nombre apellido")
            .populate("conductor", "nombre telefono unidad foto_identificacion")
            .lean();

        if (!chat) return NextResponse.json({ ok: false, error: "Chat no encontrado" }, { status: 404 });

        // ── Verificar permisos por rol ─────────────────────────────────────────
        const lineaId = chat.linea?._id?.toString() ?? chat.linea?.toString();

        if (user.rol !== "admin" && lineaId !== user.linea) {
            return NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 });
        }

        // Inyectar foto del conductor SOLO en mensajes de despacho de FoxPro (contienen "CHOFER:")
        const conductorAny = chat.conductor as any;
        if (conductorAny?.foto_identificacion && chat.mensajes?.length) {
            for (const msg of chat.mensajes) {
                if (msg.origen === "sistema" && /CHOFER:/i.test(msg.texto || '') && !msg.media_url) {
                    msg.tipo = "image";
                    msg.media_url = conductorAny.foto_identificacion;
                }
            }
        }

        return NextResponse.json({ ok: true, data: chat });
    } catch (error) {
        console.error(`[/api/chats/${id} GET] Error:`, error);
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

// PATCH /api/chats/[id] — Cambiar estado del chat
async function patchHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });

    const { id } = await params;

    await connectDB();

    let body;
    try {
        body = await req.json();
    } catch (e) {
        console.warn(`[PATCH /api/chats/${id}] Intento de actualización con cuerpo vacío o inválido`);
        return NextResponse.json({ ok: false, error: "Cuerpo de solicitud requerido y debe ser JSON válido" }, { status: 400 });
    }
    const { estado, operador, cliente_nombre, bloqueado } = body;

    const allowed: string[] = ["pendiente", "bot_atendiendo", "esperando_operador", "en_atencion", "cerrado"];
    if (estado && !allowed.includes(estado)) {
        return NextResponse.json({ ok: false, error: "Estado inválido" }, { status: 400 });
    }

    try {
        const chat = await ChatsModel.findById(id);
        if (!chat) return NextResponse.json({ ok: false, error: "Chat no encontrado" }, { status: 404 });

        // Verificar permisos
        const lineaId = chat.linea?.toString();
        if (user.rol !== "admin" && lineaId !== user.linea) {
            return NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 });
        }

        const estadoAnterior = chat.estado;
        if (estado) chat.estado = estado;
        if (operador !== undefined) chat.operador = operador;
        if (cliente_nombre !== undefined) chat.cliente_nombre = cliente_nombre;
        if (bloqueado !== undefined) chat.bloqueado = bloqueado;
        await chat.save();

        // ── DISPARAR IA SI EL ESTADO CAMBIA A PENDIENTE ───────────────────────
        if (estado === "pendiente" && estadoAnterior !== "pendiente") {
            console.log(`[CHAT-PATCH] Estado cambiado a pendiente para chat ${id}. Intentando disparar IA...`);
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
            
            // Disparar de forma asíncrona para no bloquear la respuesta de la API
            (async () => {
                try {
                    const endpoint = chat.platform === 'telegram' ? '/api/telegram/ai-reply' : '/api/whatsapp/ai-reply';
                    const aiRes = await fetch(`${baseUrl}${endpoint}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            lineaId: chat.linea.toString(),
                            chatId: chat._id.toString(),
                            senderId: chat.tg_user_id || chat.cliente_phone,
                        }),
                    });
                    if (!aiRes.ok) console.error(`[CHAT-PATCH-AI] Fallo al disparar IA (${chat.platform}):`, await aiRes.json().catch(() => ({})));
                } catch (e: any) {
                    console.error(`[CHAT-PATCH-AI] Error crítico:`, e.message);
                }
            })();
        }

        // Emitir evento Socket.io
        const io = (global as any).io;
        if (io) {
            console.log(`[PATCH /api/chats/${id}] Emitiendo chat:estado_cambiado a linea:${lineaId} y linea:admin`);
            io.to(`linea:${lineaId}`).to('linea:admin').emit("chat:estado_cambiado", {
                chatId: id,
                estado: chat.estado,
                cliente_nombre: chat.cliente_nombre,
            });
        } else {
            console.log(`[PATCH /api/chats/${id}] WARNING: global.io NO ESTA DEFINIDO`);
        }

        return NextResponse.json({ ok: true, data: { _id: chat._id, estado: chat.estado } });
    } catch (error) {
        console.error(`[/api/chats/${id} PATCH] Error:`, error);
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);

// DELETE /api/chats/[id] — Eliminar chat
async function deleteHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });

    const { id } = await params;

    await connectDB();

    try {
        const chat = await ChatsModel.findById(id);
        if (!chat) return NextResponse.json({ ok: false, error: "Chat no encontrado" }, { status: 404 });

        const lineaId = chat.linea?.toString();
        if (user.rol !== "admin" && lineaId !== user.linea) {
            return NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 });
        }

        await ChatsModel.findByIdAndDelete(id);

        // Notificar al sidebar para que elimine el chat
        if (global.io) {
            global.io.to(`linea:${lineaId}`).to('linea:admin').emit('chat:eliminado', { chatId: id });
        }

        return NextResponse.json({ ok: true, data: { deletedId: id } });
    } catch (error) {
        console.error(`[/api/chats/${id} DELETE] Error:`, error);
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

export const DELETE = withAuth(deleteHandler);
