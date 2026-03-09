import { NextRequest, NextResponse } from "next/server";
import { withAuth, getUserFromRequest } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import OperadoresModel from "@/models/Operadores";
import ChatsModel from "@/models/Chats";
import mongoose from "mongoose";

async function handler(req: NextRequest) {
    try {
        const user = getUserFromRequest(req);
        if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
        if (user.rol !== "admin" && user.rol !== "admin_linea") {
            return NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 });
        }

        await connectDB();

        const lineaId = new mongoose.Types.ObjectId(user.linea);

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

        // Contar mensajes de hoy y del mes usando el array embebido en Chats
        const mensajesAgg = await ChatsModel.aggregate([
            { $match: { linea: lineaId } },
            { $unwind: "$mensajes" },
            {
                $facet: {
                    hoy: [
                        { $match: { "mensajes.timestamp": { $gte: hoy } } },
                        { $count: "total" },
                    ],
                    mes: [
                        { $match: { "mensajes.timestamp": { $gte: inicioMes } } },
                        { $count: "total" },
                    ],
                },
            },
        ]);

        const mensajesHoy = mensajesAgg[0]?.hoy?.[0]?.total ?? 0;
        const mensajesMes = mensajesAgg[0]?.mes?.[0]?.total ?? 0;

        const [
            chatsActivosHoy,
            operadoresEnLinea,
        ] = await Promise.all([
            ChatsModel.countDocuments({
                linea: lineaId,
                estado: { $in: ["pendiente", "bot_atendiendo", "esperando_operador", "en_atencion"] },
            }),
            OperadoresModel.countDocuments({
                linea: lineaId,
                status: { $in: ["en_linea", "turno_abierto", "ocupado"] },
            }),
        ]);

        return NextResponse.json({
            ok: true,
            data: {
                chatsActivos: chatsActivosHoy,
                mensajesHoy,
                mensajesMes,
                operadoresEnLinea,
            },
        });
    } catch (error) {
        console.error("[ESTADISTICAS/LINEA] Error:", error);
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

export const GET = withAuth(handler);
