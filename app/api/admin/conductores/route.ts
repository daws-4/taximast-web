import { NextRequest, NextResponse } from "next/server";
import { withAuth, getUserFromRequest } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import ConductoresModel from "@/models/Conductores";
import mongoose from "mongoose";

// GET /api/admin/conductores
async function getHandler(req: NextRequest) {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });

    try {
        await connectDB();

        // admin ve todos; admin_linea y operador solo ven su línea
        const filtro = user.rol === "admin"
            ? {}
            : { linea: new mongoose.Types.ObjectId(user.linea) };

        const conductores = await ConductoresModel.find(filtro)
            .populate("linea", "name")
            .sort({ createdAt: -1 });

        return NextResponse.json({ ok: true, data: conductores });
    } catch (error) {
        console.error("[ADMIN/CONDUCTORES GET] Error:", error);
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

// POST /api/admin/conductores — crear conductor
async function postHandler(req: NextRequest) {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (user.rol !== "admin" && user.rol !== "admin_linea") {
        return NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 });
    }

    try {
        await connectDB();

        const body = await req.json();
        const { nombre, cedula, telefono, control, placa, notas, linea, foto_identificacion } = body;

        if (!nombre || !telefono) {
            return NextResponse.json({ ok: false, error: "Nombre y teléfono son obligatorios" }, { status: 400 });
        }

        // admin_linea siempre crea en su propia línea
        const lineaFinal = user.rol === "admin_linea" ? user.linea : linea;

        if (!lineaFinal) {
            return NextResponse.json({ ok: false, error: "La línea es requerida" }, { status: 400 });
        }

        const conductor = await ConductoresModel.create({
            nombre: nombre.trim(),
            cedula: cedula?.trim() || undefined,
            telefono: telefono?.trim() || undefined,
            control: control?.trim() || undefined,
            placa: placa?.trim() || undefined,
            notas: notas?.trim() || undefined,
            foto_identificacion: foto_identificacion || undefined,
            linea: new mongoose.Types.ObjectId(lineaFinal),
        });

        return NextResponse.json({
            ok: true,
            data: conductor,
        }, { status: 201 });
    } catch (error: any) {
        console.error("[ADMIN/CONDUCTORES POST] Error:", error);
        if (error.code === 11000) {
            return NextResponse.json({ ok: false, error: "Este número de teléfono ya está registrado en esta línea" }, { status: 409 });
        }
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
