import { NextRequest, NextResponse } from "next/server";
import { withAuth, getUserFromRequest } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import OperadoresModel from "@/models/Operadores";

const ESTADOS_VALIDOS = ["en_linea", "turno_abierto", "ocupado", "fuera_de_turno"] as const;
type EstadoOperador = typeof ESTADOS_VALIDOS[number];

async function handler(req: NextRequest) {
    try {
        const user = getUserFromRequest(req);
        if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });

        const body = await req.json();
        const { status } = body as { status: EstadoOperador };

        if (!ESTADOS_VALIDOS.includes(status)) {
            return NextResponse.json(
                { ok: false, error: `Estado inválido. Opciones: ${ESTADOS_VALIDOS.join(", ")}` },
                { status: 400 }
            );
        }

        await connectDB();

        const operador = await OperadoresModel.findByIdAndUpdate(
            user.id,
            { status },
            { new: true, select: "nombre status" }
        );

        if (!operador) {
            return NextResponse.json({ ok: false, error: "Operador no encontrado" }, { status: 404 });
        }

        return NextResponse.json({ ok: true, status: operador.status });
    } catch (error) {
        console.error("[OPERADORES/ME/STATUS] Error:", error);
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

export const PATCH = withAuth(handler);
