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
            .lean();

        if (!chat) return NextResponse.json({ ok: false, error: "Chat no encontrado" }, { status: 404 });

        // ── Verificar permisos por rol ─────────────────────────────────────────
        const lineaId = chat.linea?._id?.toString() ?? chat.linea?.toString();

        if (user.rol !== "admin" && lineaId !== user.linea) {
            return NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 });
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

    const body = await req.json();
    const { estado, operador } = body;

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

        if (estado) chat.estado = estado;
        if (operador !== undefined) chat.operador = operador;
        await chat.save();

        // Emitir evento Socket.io
        const io = (global as any).io;
        if (io) {
            console.log(`[PATCH /api/chats/${id}] Emitiendo chat:estado_cambiado a linea:${lineaId} y linea:admin`);
            io.to(`linea:${lineaId}`).to('linea:admin').emit("chat:estado_cambiado", {
                chatId: id,
                estado: chat.estado,
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
