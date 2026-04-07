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

        const body = await req.json();
        const updateData: Record<string, unknown> = {};

        if (body.nombre !== undefined) updateData.nombre = body.nombre.trim();
        if (body.cedula !== undefined) updateData.cedula = body.cedula?.trim() || undefined;
        if (body.telefono !== undefined) updateData.telefono = body.telefono.trim();
        if (body.unidad !== undefined) updateData.unidad = body.unidad?.trim() || undefined;
        if (body.foto_identificacion !== undefined) updateData.foto_identificacion = body.foto_identificacion;
        if (body.activo !== undefined) updateData.activo = body.activo;
        if (body.notas !== undefined) updateData.notas = body.notas?.trim() || undefined;

        // Admin global puede cambiar la línea
        if (user.rol === "admin" && body.linea !== undefined) {
            updateData.linea = new mongoose.Types.ObjectId(body.linea);
        }

        const conductor = await ConductoresModel.findByIdAndUpdate(
            id,
            { $set: updateData },
            { returnDocument: 'after', runValidators: true }
        ).populate("linea", "name");

        return NextResponse.json({ ok: true, data: conductor });
    } catch (error: any) {
        console.error("[ADMIN/CONDUCTORES PATCH] Error:", error);
        if (error.code === 11000) {
            return NextResponse.json({ ok: false, error: "Este número de teléfono ya está registrado en esta línea" }, { status: 409 });
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
