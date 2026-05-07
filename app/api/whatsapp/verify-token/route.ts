import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/whatsapp/verify-token
 *
 * Verifica si las credenciales de Meta (access_token + phone_number_id) son válidas
 * consultando la Graph API. Se llama desde el formulario de creación de líneas
 * ANTES de persistir los datos en la BD.
 *
 * Body: { access_token: string; phone_number_id: string }
 * Body: { access_token: string; phone_number_id: string; waba_id?: string }
 * Response OK:    { ok: true;  name: string }
 * Response Error: { ok: false; error: string }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { access_token, phone_number_id, waba_id, expected_number } = body as {
            access_token?: string;
            phone_number_id?: string;
            waba_id?: string;
            expected_number?: string;
        };

        if (!access_token || !phone_number_id) {
            return NextResponse.json(
                { ok: false, error: "Se requieren access_token y phone_number_id." },
                { status: 400 }
            );
        }

        // Consulta la Graph API de Meta: verifica el número de teléfono vinculado al token
        const graphUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(phone_number_id)}?access_token=${encodeURIComponent(access_token)}&fields=display_phone_number,verified_name`;

        const graphRes = await fetch(graphUrl, { method: "GET" });
        const graphData = await graphRes.json();

        // La Graph API devuelve un objeto con { id, display_phone_number, ... }
        // o { error: { message, type, code, ... } }
        if (graphData.error) {
            const msg: string =
                graphData.error.message || "Error de autenticación con Meta API";
            return NextResponse.json({ ok: false, error: msg }, { status: 200 });
        }

        if (!graphData.id) {
            return NextResponse.json(
                { ok: false, error: "Respuesta inesperada de Meta API." },
                { status: 200 }
            );
        }

        // Validación: El número de teléfono de Meta debe coincidir con el ingresado en el formulario
        if (expected_number && graphData.display_phone_number) {
            const displayClean = graphData.display_phone_number.replace(/\D/g, "");
            const expectedClean = expected_number.replace(/\D/g, "");

            if (expectedClean && displayClean && expectedClean !== displayClean) {
                return NextResponse.json({
                    ok: false,
                    error: `El ID proporcionado pertenece al número +${displayClean}, pero ingresaste +${expectedClean}. Revisa el Phone Number ID.`
                }, { status: 200 });
            }
        }

        // Nota: Removida la validación estricta del WABA ID porque el campo whatsapp_business_account
        // a veces no está disponible en la respuesta de este endpoint (error #100).

        return NextResponse.json({
            ok: true,
            name: graphData.verified_name || graphData.display_phone_number || graphData.id,
            display_phone_number: graphData.display_phone_number ?? null,
        });
    } catch (err) {
        console.error("[WHATSAPP/VERIFY-TOKEN] Error de red:", err);
        return NextResponse.json(
            { ok: false, error: "Error de red al contactar Meta API." },
            { status: 500 }
        );
    }
}
