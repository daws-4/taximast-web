import { NextRequest, NextResponse } from 'next/server';

/**
 * Valida la clave de API enviada por FoxPro en el header `x-api-key`.
 * La clave se compara contra la variable de entorno `WA_API_KEY`.
 *
 * Uso:
 *   const authError = validateApiKey(req);
 *   if (authError) return authError;
 *
 * @returns `NextResponse` con 401 si la clave es inválida/ausente, `null` si es correcta.
 */
export function validateApiKey(req: NextRequest): NextResponse | null {
    const expectedKey = process.env.WA_API_KEY;

    if (!expectedKey) {
        console.error('[apiAuth] WA_API_KEY no está configurada en el entorno');
        return NextResponse.json(
            { success: false, error: 'Configuración de servidor incorrecta' },
            { status: 500 }
        );
    }

    const providedKey = req.headers.get('x-api-key');
    const authHeader = req.headers.get('Authorization');
    
    let token = providedKey;

    // Si no viene en x-api-key, buscar en Authorization: Bearer <token>
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }

    if (!token || token !== expectedKey) {
        return NextResponse.json(
            { success: false, error: 'API key inválida o ausente' },
            { status: 401 }
        );
    }

    return null; // clave válida
}
