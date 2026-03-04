import { NextRequest, NextResponse } from "next/server";
import { withAuth, getUserFromRequest } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import ChatsModel from "@/models/Chats";
import LineasModel from "@/models/Lineas";

// GET /api/chats — Lista de chats filtrada por rol
async function getHandler(req: NextRequest) {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });

    await connectDB();

    const { searchParams } = req.nextUrl;
    const lineaFilter = searchParams.get("linea");   // solo admin puede usarlo
    const estadoFilter = searchParams.get("estado");
    const q = searchParams.get("q")?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filtro: Record<string, any> = {};

    // ── Scope por rol ──────────────────────────────────────────────────────────
    if (user.rol === "admin") {
        // Admin global: puede ver todas las líneas o filtrar por una
        if (lineaFilter) filtro.linea = lineaFilter;
    } else {
        // admin_linea y operador: solo ven chats de su propia línea
        filtro.linea = user.linea;
    }

    // ── Filtros opcionales ─────────────────────────────────────────────────────
    if (estadoFilter) filtro.estado = estadoFilter;

    if (q) {
        filtro.$or = [
            { cliente_phone: { $regex: q, $options: "i" } },
            { cliente_nombre: { $regex: q, $options: "i" } },
        ];
    }

    try {
        const chats = await ChatsModel.find(filtro)
            .select("linea operador cliente_phone cliente_nombre estado ultimoMensaje createdAt")
            .populate("linea", "name")
            .populate("operador", "nombre apellido")
            .sort({ ultimoMensaje: -1 })
            .limit(100)
            .lean();

        return NextResponse.json({ ok: true, data: chats });
    } catch (error) {
        console.error("[/api/chats GET] Error:", error);
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

// POST /api/chats — Crear un nuevo chat manualmente (admin / admin_linea)
async function postHandler(req: NextRequest) {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (user.rol === "operador") return NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 });

    await connectDB();

    const body = await req.json();
    const { cliente_phone, cliente_nombre, lineaId } = body;

    if (!cliente_phone) {
        return NextResponse.json({ ok: false, error: "cliente_phone es requerido" }, { status: 400 });
    }

    // Determinar la línea: admin puede especificar, los demás usan la suya
    const resolvedLinea = user.rol === "admin" ? (lineaId || null) : user.linea;

    if (!resolvedLinea) {
        return NextResponse.json({ ok: false, error: "Se requiere lineaId para admin global" }, { status: 400 });
    }

    try {
        const linea = await LineasModel.findById(resolvedLinea).select("_id name").lean();
        if (!linea) return NextResponse.json({ ok: false, error: "Línea no encontrada" }, { status: 404 });

        const chat = await ChatsModel.create({
            linea: resolvedLinea,
            cliente_phone: cliente_phone.trim(),
            cliente_nombre: cliente_nombre?.trim(),
            estado: "abierto",
        });

        // Emitir evento Socket.io si el servidor está disponible
        if (global.io) {
            const payload = {
                _id: chat._id,
                linea: { _id: linea._id, name: (linea as { name: string }).name },
                cliente_phone: chat.cliente_phone,
                cliente_nombre: chat.cliente_nombre,
                estado: chat.estado,
                ultimoMensaje: chat.ultimoMensaje,
            };
            global.io.to(`linea:${resolvedLinea}`).emit("chat:nuevo_chat", payload);
        }

        return NextResponse.json({ ok: true, data: chat }, { status: 201 });
    } catch (error: unknown) {
        console.error("[/api/chats POST] Error:", error);
        if ((error as { code?: number }).code === 11000) {
            // Ya existe un chat con ese número en esa línea — devolver el existente
            const existing = await ChatsModel.findOne({
                linea: resolvedLinea,
                cliente_phone: cliente_phone.trim(),
            }).lean();
            return NextResponse.json({ ok: true, data: existing, exists: true });
        }
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
