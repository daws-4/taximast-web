import { NextRequest, NextResponse } from "next/server";
import { withAuth, getUserFromRequest } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import OperadoresModel from "@/models/Operadores";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

// GET /api/admin/operadores
async function getHandler(req: NextRequest) {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (user.rol !== "admin" && user.rol !== "admin_linea") {
        return NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 });
    }

    try {
        await connectDB();

        // admin_linea solo ve operadores de su propia línea
        const filtro = user.rol === "admin"
            ? {}
            : { linea: new mongoose.Types.ObjectId(user.linea) };

        const operadores = await OperadoresModel.find(filtro)
            .select("-password")
            .populate("linea", "name")
            .sort({ createdAt: -1 });

        return NextResponse.json({ ok: true, data: operadores });
    } catch (error) {
        console.error("[ADMIN/OPERADORES GET] Error:", error);
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

// POST /api/admin/operadores — crear operador
async function postHandler(req: NextRequest) {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (user.rol !== "admin" && user.rol !== "admin_linea") {
        return NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 });
    }

    try {
        await connectDB();

        const body = await req.json();
        const { nombre, apellido, username, password, email, rol, linea } = body;

        if (!nombre || !apellido || !username || !password) {
            return NextResponse.json({ ok: false, error: "Faltan campos obligatorios" }, { status: 400 });
        }

        if (password.length < 8) {
            return NextResponse.json({ ok: false, error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
        }

        // admin_linea no puede crear otros admin o admin_linea de otra línea
        const rolFinal = user.rol === "admin_linea" ? "operador" : (rol || "operador");
        // admin_linea siempre crea operadores en su propia línea
        const lineaFinal = user.rol === "admin_linea" ? user.linea : linea;

        if (!lineaFinal) {
            return NextResponse.json({ ok: false, error: "La línea es requerida" }, { status: 400 });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const operador = await OperadoresModel.create({
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            username: username.toLowerCase().trim(),
            password: passwordHash,
            email: email?.toLowerCase().trim() || undefined,
            rol: rolFinal,
            linea: new mongoose.Types.ObjectId(lineaFinal),
        });

        return NextResponse.json({
            ok: true,
            data: { _id: operador._id, nombre: operador.nombre, apellido: operador.apellido, username: operador.username, rol: operador.rol },
        }, { status: 201 });
    } catch (error: any) {
        console.error("[ADMIN/OPERADORES POST] Error:", error);
        if (error.code === 11000) {
            return NextResponse.json({ ok: false, error: "El nombre de usuario ya existe" }, { status: 409 });
        }
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
