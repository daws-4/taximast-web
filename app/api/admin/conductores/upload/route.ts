import { NextRequest, NextResponse } from "next/server";
import { withAuth, getUserFromRequest } from "@/lib/auth";
import { uploadDriverPhoto } from "@/lib/pocketbase";

// POST /api/admin/conductores/upload — subir foto de identificación a PocketBase
async function postHandler(req: NextRequest) {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (user.rol !== "admin" && user.rol !== "admin_linea") {
        return NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("foto") as File | null;
        const telefono = formData.get("telefono") as string | null;

        if (!file) {
            return NextResponse.json({ ok: false, error: "No se envió ningún archivo" }, { status: 400 });
        }

        if (!telefono) {
            return NextResponse.json({ ok: false, error: "Se requiere el campo 'telefono' para asociar la foto" }, { status: 400 });
        }

        // Validar tipo de archivo
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ ok: false, error: "Solo se permiten imágenes JPG, PNG o WebP" }, { status: 400 });
        }

        // Validar tamaño (5MB máximo)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ ok: false, error: "El archivo no puede superar 5MB" }, { status: 400 });
        }

        // Subir a PocketBase
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const url = await uploadDriverPhoto(telefono, buffer, file.name);

        if (!url) {
            return NextResponse.json(
                { ok: false, error: "Error al subir la foto a PocketBase. Verifica la conexión." },
                { status: 502 }
            );
        }

        return NextResponse.json({ ok: true, data: { url } }, { status: 201 });
    } catch (error) {
        console.error("[ADMIN/CONDUCTORES UPLOAD] Error:", error);
        return NextResponse.json({ ok: false, error: "Error al subir el archivo" }, { status: 500 });
    }
}

export const POST = withAuth(postHandler);
