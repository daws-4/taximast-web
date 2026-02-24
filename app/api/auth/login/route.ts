import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import OperadoresModel from "@/models/Operadores";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { username, password } = body as { username: string; password: string };

        if (!username || !password) {
            return NextResponse.json(
                { ok: false, error: "Usuario y contraseña son requeridos" },
                { status: 400 }
            );
        }

        await connectDB();

        // Buscar operador; incluir el password explícitamente (campo con select:false no aplica aquí, pero buena práctica)
        const operador = await OperadoresModel.findOne({
            username: username.toLowerCase().trim(),
        }).select("+password");

        if (!operador) {
            return NextResponse.json(
                { ok: false, error: "Credenciales inválidas" },
                { status: 401 }
            );
        }

        // Verificar contraseña
        const passwordMatch = await bcrypt.compare(password, operador.password);

        if (!passwordMatch) {
            return NextResponse.json(
                { ok: false, error: "Credenciales inválidas" },
                { status: 401 }
            );
        }

        // Generar JWT
        const token = signToken({
            id: operador._id.toString(),
            username: operador.username,
            nombre: operador.nombre,
            rol: operador.rol,
            linea: operador.linea.toString(),
        });

        // Respuesta con cookie HttpOnly
        const response = NextResponse.json({
            ok: true,
            operador: {
                nombre: operador.nombre,
                apellido: operador.apellido,
                rol: operador.rol,
            },
        });

        response.cookies.set("taximast_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24, // 24 horas en segundos
            path: "/",
        });

        return response;
    } catch (error) {
        console.error("[AUTH/LOGIN] Error:", error);
        return NextResponse.json(
            { ok: false, error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
