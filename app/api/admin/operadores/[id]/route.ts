import { NextRequest, NextResponse } from "next/server";
import { withAuth, getUserFromRequest } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import OperadoresModel from "@/models/Operadores";
import mongoose from "mongoose";

// PATCH /api/admin/operadores/[id] — editar operador
async function patchHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (user.rol !== "admin" && user.rol !== "admin_linea") {
        return NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 });
    }

    try {
        await connectDB();
        const { id } = await params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
        }

        const body = await req.json();
        const { nombre, apellido, email, rol, linea } = body;

        // Validar que el operador existe y permisos de modificarlo
        const operadorActual = await OperadoresModel.findById(id);
        if (!operadorActual) {
            return NextResponse.json({ ok: false, error: "Operador no encontrado" }, { status: 404 });
        }

        if (user.rol === "admin_linea") {
            // El admin de línea solo puede modificar operadores de su propia línea
            if (operadorActual.linea.toString() !== user.linea) {
                return NextResponse.json({ ok: false, error: "No tienes permiso para modificar este operador" }, { status: 403 });
            }
        }

        // Construir actualización
        const updateData: any = {};
        if (nombre !== undefined) updateData.nombre = nombre.trim();
        if (apellido !== undefined) updateData.apellido = apellido.trim();
        if (email !== undefined) updateData.email = email ? email.toLowerCase().trim() : undefined;

        // Admin global puede cambiar todo
        if (user.rol === "admin") {
            if (rol !== undefined && ["admin", "admin_linea", "operador"].includes(rol)) {
                updateData.rol = rol;
            }
            if (linea !== undefined) {
                updateData.linea = new mongoose.Types.ObjectId(linea);
            }
        } else if (user.rol === "admin_linea") {
            // Admin linea puede cambiar rol pero no a admin global
            if (rol !== undefined && ["admin_linea", "operador"].includes(rol)) {
                updateData.rol = rol;
            }
            // Admin linea no puede cambiar la línea asignada (siempre será la suya)
            if (linea !== undefined && linea === user.linea) {
                updateData.linea = new mongoose.Types.ObjectId(linea);
            }
        }

        const operador = await OperadoresModel.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select("-password").populate("linea", "name");

        return NextResponse.json({
            ok: true,
            data: operador,
        });
    } catch (error: any) {
        console.error("[ADMIN/OPERADORES PATCH] Error:", error);
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

// DELETE /api/admin/operadores/[id] — eliminar operador
async function deleteHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (user.rol !== "admin" && user.rol !== "admin_linea") {
        return NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 });
    }

    try {
        await connectDB();
        const { id } = await params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
        }

        const operadorActual = await OperadoresModel.findById(id);
        if (!operadorActual) {
            return NextResponse.json({ ok: false, error: "Operador no encontrado" }, { status: 404 });
        }

        if (user.rol === "admin_linea") {
            if (operadorActual.linea.toString() !== user.linea) {
                return NextResponse.json({ ok: false, error: "No tienes permiso para eliminar este operador" }, { status: 403 });
            }
        }

        // Proteger no eliminar a sí mismo
        if (operadorActual._id.toString() === user.id) {
            return NextResponse.json({ ok: false, error: "No puedes eliminar tu propia cuenta" }, { status: 400 });
        }

        await OperadoresModel.findByIdAndDelete(id);

        return NextResponse.json({ ok: true, data: { deletedId: id } });
    } catch (error: any) {
        console.error("[ADMIN/OPERADORES DELETE] Error:", error);
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

export const PATCH = withAuth(patchHandler);
export const DELETE = withAuth(deleteHandler);
