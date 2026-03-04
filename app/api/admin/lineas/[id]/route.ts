import { NextRequest, NextResponse } from "next/server";
import { withAuth, getUserFromRequest } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import LineasModel from "@/models/Lineas";
import OperadorModel from "@/models/Operadores";

// PATCH /api/admin/lineas/[id] — editar línea (requiere validar Meta API p/ tokens)
async function patchHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = getUserFromRequest(req);
    if (!user || user.rol !== "admin") return NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 });

    try {
        await connectDB();
        const { id } = await params;
        const body = await req.json();

        const linea = await LineasModel.findById(id);
        if (!linea) return NextResponse.json({ ok: false, error: "Línea no encontrada" }, { status: 404 });

        // Si se están actualizando las credenciales, primero validar con Meta
        const hasId = body.phone_number_id?.trim();
        const hasToken = body.access_token?.trim();

        if (hasId || hasToken) {
            const checkId = hasId || linea.phone_number_id;
            const checkToken = hasToken || linea.access_token;

            try {
                // Probamos traer el perfil para validar permisos
                const metaRes = await fetch(`https://graph.facebook.com/v20.0/${checkId}/whatsapp_business_profile?fields=name,profile_picture_url`, {
                    headers: { "Authorization": `Bearer ${checkToken}` }
                });

                const metaData = await metaRes.json();

                if (!metaRes.ok || metaData.error) {
                    return NextResponse.json({
                        ok: false,
                        error: metaData.error?.message || "Credenciales de Meta inválidas verificando el token/ID."
                    }, { status: 400 });
                }
            } catch (err) {
                console.error("[META VALIDATION ERROR]", err);
                return NextResponse.json({ ok: false, error: "La conexión con la API de Meta falló al validar credenciales." }, { status: 500 });
            }
        }

        // Actualizar datos
        if (body.name !== undefined) linea.name = body.name.trim();
        if (body.whatsapp_number !== undefined) linea.whatsapp_number = body.whatsapp_number.trim();
        if (body.phone_number_id !== undefined) linea.phone_number_id = body.phone_number_id.trim();
        if (body.waba_id !== undefined) linea.waba_id = body.waba_id.trim();
        if (body.access_token !== undefined) linea.access_token = body.access_token.trim();
        if (body.verify_token !== undefined) linea.verify_token = body.verify_token.trim();
        if (body.activa !== undefined) linea.activa = body.activa;

        await linea.save();

        return NextResponse.json({ ok: true, data: { _id: linea._id, name: linea.name } });
    } catch (error: any) {
        console.error("[ADMIN/LINEAS PATCH] Error:", error);
        if (error.code === 11000) return NextResponse.json({ ok: false, error: "Ya existe una línea con ese WhatsApp" }, { status: 409 });
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

// DELETE /api/admin/lineas/[id] — eliminar línea
async function deleteHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = getUserFromRequest(req);
    if (!user || user.rol !== "admin") return NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 });

    try {
        await connectDB();
        const { id } = await params;

        // Comprobar si hay operadores asignados
        const operadoresCount = await OperadorModel.countDocuments({ linea: id });
        if (operadoresCount > 0) {
            return NextResponse.json({ ok: false, error: `No se puede eliminar la línea porque tiene ${operadoresCount} operador(es) asignado(s). Elimínelos o reasígnelos primero.` }, { status: 400 });
        }

        const linea = await LineasModel.findByIdAndDelete(id);
        if (!linea) return NextResponse.json({ ok: false, error: "Línea no encontrada" }, { status: 404 });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[ADMIN/LINEAS DELETE] Error:", error);
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

export const PATCH = withAuth(patchHandler);
export const DELETE = withAuth(deleteHandler);
