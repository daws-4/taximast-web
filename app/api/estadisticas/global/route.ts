import { NextRequest, NextResponse } from "next/server";
import { withAuth, getUserFromRequest } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import MensajesModel from "@/models/Mensajes";
import OperadoresModel from "@/models/Operadores";
import LineasModel from "@/models/Lineas";

async function handler(req: NextRequest) {
    try {
        const user = getUserFromRequest(req);
        if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
        if (user.rol !== "admin") return NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 });

        await connectDB();

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const [
            totalMensajesHoy,
            operadoresEnLinea,
            lineasActivas,
            chatsActivosHoy,
        ] = await Promise.all([
            // Total de mensajes enviados/recibidos hoy en todas las líneas
            MensajesModel.countDocuments({ timestamp_whatsapp: { $gte: hoy } }),
            // Operadores actualmente en turno en cualquier línea
            OperadoresModel.countDocuments({ status: { $in: ["en_linea", "turno_abierto", "ocupado"] } }),
            // Líneas operativas
            LineasModel.countDocuments({ activa: true }),
            // Contactos únicos que enviaron mensajes hoy (chats activos)
            MensajesModel.distinct("cliente_numero", {
                direccion: "entrante",
                timestamp_whatsapp: { $gte: hoy },
            }).then((nums) => nums.length),
        ]);

        return NextResponse.json({
            ok: true,
            data: {
                chatsActivos: chatsActivosHoy,
                mensajesHoy: totalMensajesHoy,
                operadoresEnLinea,
                lineasActivas,
            },
        });
    } catch (error) {
        console.error("[ESTADISTICAS/GLOBAL] Error:", error);
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

export const GET = withAuth(handler);
