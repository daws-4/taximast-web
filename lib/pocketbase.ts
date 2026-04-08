/**
 * PocketBase helper — gestión de fotos de conductores
 *
 * Colección: TAXIMAST_conductores
 * Campos:    telefono (text), foto (file/image)
 *
 * Todas las funciones son "safe": si PocketBase no está disponible
 * o no encuentra el registro, retornan null sin lanzar excepciones.
 */

const PB_URL = process.env.NEXT_PUBLIC_PB_URL || '';
const PB_EMAIL = process.env.PB_ADMIN_EMAIL || '';
const PB_PASS = process.env.PB_ADMIN_PASS || '';
const COLLECTION = 'TAXIMAST_conductores';

// ── Cache del token de admin (evita autenticar en cada request) ──────────────
let adminToken: string | null = null;
let tokenExpiry = 0;

/**
 * Autenticarse como admin en PocketBase y cachear el token.
 */
async function getAdminToken(): Promise<string | null> {
    if (adminToken && Date.now() < tokenExpiry) return adminToken;

    try {
        const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASS }),
        });

        if (!res.ok) {
            console.error('[pocketbase] Auth failed:', res.status, await res.text());
            return null;
        }

        const data = await res.json();
        adminToken = data.token;
        // Expirar 1 hora antes por seguridad (PB tokens duran ~2 semanas)
        tokenExpiry = Date.now() + 1000 * 60 * 60 * 24;
        return adminToken;
    } catch (err) {
        console.error('[pocketbase] Auth error:', err);
        return null;
    }
}

// ── Normalizar teléfono ─────────────────────────────────────────────────────
// El desktop puede enviar "04241234567" y el web "584241234567".
// Normalizamos quitando el prefijo 58 y el 0 inicial para comparar solo los
// últimos 10 dígitos significativos.
function normalizePhone(phone: string): string {
    let p = phone.replace(/\D/g, '');
    if (p.startsWith('58')) p = p.slice(2);
    if (p.startsWith('0')) p = p.slice(1);
    return p;  // Ej: "4241234567"
}

/**
 * Buscar un registro en TAXIMAST_conductores por teléfono.
 * Retorna el record (con id, telefono, foto) o null.
 */
async function findByPhone(telefono: string): Promise<{ id: string; telefono: string; foto: string; collectionId: string } | null> {
    const token = await getAdminToken();
    if (!token) return null;

    const norm = normalizePhone(telefono);

    try {
        // Intentar buscar con diferentes formatos de teléfono
        const variants = [
            telefono,
            norm,
            `0${norm}`,
            `58${norm}`,
        ];

        const filterParts = variants.map(v => `telefono='${v}'`).join(' || ');

        const res = await fetch(
            `${PB_URL}/api/collections/${COLLECTION}/records?filter=(${encodeURIComponent(filterParts)})&perPage=1`,
            { headers: { 'Authorization': token } }
        );

        if (!res.ok) return null;

        const data = await res.json();
        if (data.items?.length > 0) return data.items[0];
        return null;
    } catch (err) {
        console.error('[pocketbase] findByPhone error:', err);
        return null;
    }
}

/**
 * Obtener la URL pública de la foto de un conductor por su teléfono.
 * Retorna la URL completa o null si no existe.
 */
export async function getDriverPhotoUrl(telefono: string): Promise<string | null> {
    if (!PB_URL || !telefono) return null;

    try {
        const record = await findByPhone(telefono);
        if (!record || !record.foto) return null;

        // PocketBase file URL format: /api/files/{collectionId}/{recordId}/{filename}
        return `${PB_URL}/api/files/${record.collectionId}/${record.id}/${record.foto}`;
    } catch (err) {
        console.error('[pocketbase] getDriverPhotoUrl error:', err);
        return null;
    }
}

/**
 * Subir o actualizar la foto de un conductor en PocketBase.
 * Si ya existe un registro con ese teléfono, actualiza la foto.
 * Si no existe, crea uno nuevo.
 *
 * @returns URL pública de la foto subida, o null si falla.
 */
export async function uploadDriverPhoto(
    telefono: string,
    fileBuffer: Buffer,
    fileName: string
): Promise<string | null> {
    if (!PB_URL) return null;

    const token = await getAdminToken();
    if (!token) return null;

    try {
        const existing = await findByPhone(telefono);

        const formData = new FormData();
        const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'image/jpeg' });
        formData.append('foto', blob, fileName);

        let res: Response;

        if (existing) {
            // Actualizar registro existente
            res = await fetch(
                `${PB_URL}/api/collections/${COLLECTION}/records/${existing.id}`,
                {
                    method: 'PATCH',
                    headers: { 'Authorization': token },
                    body: formData,
                }
            );
        } else {
            // Crear nuevo registro
            formData.append('telefono', telefono);
            res = await fetch(
                `${PB_URL}/api/collections/${COLLECTION}/records`,
                {
                    method: 'POST',
                    headers: { 'Authorization': token },
                    body: formData,
                }
            );
        }

        if (!res.ok) {
            console.error('[pocketbase] Upload failed:', res.status, await res.text());
            return null;
        }

        const record = await res.json();
        if (record.foto) {
            return `${PB_URL}/api/files/${record.collectionId}/${record.id}/${record.foto}`;
        }
        return null;
    } catch (err) {
        console.error('[pocketbase] uploadDriverPhoto error:', err);
        return null;
    }
}

// ── Stickers ─────────────────────────────────────────────────────────────

const STICKERS_COLLECTION = 'TAXIMAST_stickers';

export interface Sticker {
    id: string;
    nombre: string;
    emoji: string;
    url: string;
}

export async function getStickers(): Promise<Sticker[]> {
    if (!PB_URL) return [];
    
    // We can fetch stickers without auth if public, but using admin token is safest
    const token = await getAdminToken();
    if (!token) return [];

    try {
        const res = await fetch(`${PB_URL}/api/collections/${STICKERS_COLLECTION}/records?perPage=100`, { 
            headers: { 'Authorization': token } 
        });

        if (!res.ok) return [];

        const data = await res.json();
        /* eslint-disable @typescript-eslint/no-explicit-any */
        return (data.items || []).map((record: any) => ({
            id: record.id,
            nombre: record.nombre,
            emoji: record.emoji,
            url: `${PB_URL}/api/files/${record.collectionId}/${record.id}/${record.archivo}`
        }));
    } catch (err) {
        console.error('[pocketbase] getStickers error:', err);
        return [];
    }
}
