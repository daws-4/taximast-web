import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import OperadoresModel from "@/models/Operadores";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const token = getTokenFromRequest(req);

        if (!token) {
            return NextResponse.json(
                { ok: false, error: "No autenticado" },
                { status: 401 }
            );
        }

        const payload = verifyToken(token);

        if (!payload) {
            return NextResponse.json(
                { ok: false, error: "Token inválido o expirado" },
                { status: 401 }
            );
        }

        await connectDB();

        // Obtener datos frescos del operador desde la BD (sin campos sensibles)
        const operador = await OperadoresModel.findById(payload.id).select(
            "-password"
        );

        if (!operador) {
            return NextResponse.json(
                { ok: false, error: "Operador no encontrado" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            ok: true,
            operador: {
                id: operador._id.toString(),
                nombre: operador.nombre,
                apellido: operador.apellido,
                username: operador.username,
                email: operador.email,
                rol: operador.rol,
                status: operador.status,
                linea: operador.linea.toString(),
            },
        });
    } catch (error) {
        console.error("[AUTH/ME] Error:", error);
        return NextResponse.json(
            { ok: false, error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
