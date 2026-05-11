import { NextRequest, NextResponse } from "next/server";
import { withAuth, getUserFromRequest } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import ConductoresModel from "@/models/Conductores";
import mongoose from "mongoose";

// PATCH /api/admin/conductores/[id] — editar conductor
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

        const conductorActual = await ConductoresModel.findById(id);
        if (!conductorActual) {
            return NextResponse.json({ ok: false, error: "Conductor no encontrado" }, { status: 404 });
        }

        if (user.rol === "admin_linea") {
            if (conductorActual.linea.toString() !== user.linea) {
                return NextResponse.json({ ok: false, error: "No tienes permiso para modificar este conductor" }, { status: 403 });
            }
        }

        let body: Record<string, unknown>;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ ok: false, error: "El cuerpo de la solicitud está vacío o no es JSON válido" }, { status: 400 });
        }
        const updateData: Record<string, unknown> = {};
        const unsetData: Record<string, ""  > = {};

        // Campos de texto: si vienen vacíos los eliminamos del documento, si tienen valor los actualizamos
        const textFields: Array<keyof typeof body> = ['nombre', 'cedula', 'telefono', 'control', 'placa', 'notas', 'foto_identificacion'];
        for (const field of textFields) {
            if (body[field] !== undefined) {
                const val = typeof body[field] === 'string' ? body[field].trim() : body[field];
                if (val === '' || val === null) {
                    unsetData[field as string] = "";
                } else {
                    updateData[field as string] = val;
                }
            }
        }

        if (body.activo !== undefined) updateData.activo = body.activo;

        // Admin global puede cambiar la línea
        if (user.rol === 'admin' && typeof body.linea === 'string' && body.linea) {
            updateData.linea = new mongoose.Types.ObjectId(body.linea);
        }

        const mongoUpdate: Record<string, unknown> = {};
        if (Object.keys(updateData).length > 0) mongoUpdate.$set = updateData;
        if (Object.keys(unsetData).length > 0) mongoUpdate.$unset = unsetData;

        if (Object.keys(mongoUpdate).length === 0) {
            return NextResponse.json({ ok: true, data: conductorActual }, { status: 200 });
        }

        const conductor = await ConductoresModel.findByIdAndUpdate(
            id,
            mongoUpdate,
            { returnDocument: 'after', runValidators: true }
        ).populate("linea", "name");

        return NextResponse.json({ ok: true, data: conductor });
    } catch (error: any) {
        console.error("[ADMIN/CONDUCTORES PATCH] Error:", error);
        if (error.code === 11000) {
            const keyPattern = error.keyPattern || {};
            if (keyPattern.cedula) {
                return NextResponse.json({ ok: false, error: "Esta cédula ya está registrada para otro conductor en esta línea" }, { status: 409 });
            }
            if (keyPattern.telefono) {
                return NextResponse.json({ ok: false, error: "Este número de teléfono ya está registrado en esta línea" }, { status: 409 });
            }
            return NextResponse.json({ ok: false, error: "Ya existe un registro duplicado con estos datos" }, { status: 409 });
        }
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

// DELETE /api/admin/conductores/[id] — eliminar conductor
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

        const conductorActual = await ConductoresModel.findById(id);
        if (!conductorActual) {
            return NextResponse.json({ ok: false, error: "Conductor no encontrado" }, { status: 404 });
        }

        if (user.rol === "admin_linea") {
            if (conductorActual.linea.toString() !== user.linea) {
                return NextResponse.json({ ok: false, error: "No tienes permiso para eliminar este conductor" }, { status: 403 });
            }
        }

        await ConductoresModel.findByIdAndDelete(id);

        return NextResponse.json({ ok: true, data: { deletedId: id } });
    } catch (error) {
        console.error("[ADMIN/CONDUCTORES DELETE] Error:", error);
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

export const PATCH = withAuth(patchHandler);
export const DELETE = withAuth(deleteHandler);
