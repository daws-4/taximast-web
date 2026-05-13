import mongoose, { Document, Model } from "mongoose";

export interface ILinea extends Document {
    name: string;
    whatsapp_number?: string;
    phone_number_id?: string;
    waba_id?: string;
    access_token?: string;
    verify_token?: string;
    app_secret?: string; // Secreto de la aplicación de Meta para validación de firma
    telegram_api_id?: number;
    telegram_api_hash?: string;
    telegram_session?: string;
    telegram_phone?: string;
    isWhatsappConfigured: boolean;
    isTelegramConfigured: boolean;
    plataforma_despacho?: 'whatsapp' | 'telegram';
    ai_provider?: 'ai_studio' | 'vertex_ai';
    ia_activa?: boolean;
    gemini_api_key?: string;
    gemini_prompt?: string;
    tokens_input_consumed?: number;
    tokens_output_consumed?: number;
    // Respuesta automática (alternativa excluyente a la IA)
    auto_reply_activo?: boolean;
    auto_reply_mensaje?: string;
    activa: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const LineasSchema = new mongoose.Schema<ILinea>(
    {
        // Nombre comercial de la línea de taxis (ej. "Taxis El Llano")
        name: {
            required: true,
            type: String,
            trim: true,
        },
        // Número de WhatsApp Business asociado (formato internacional, ej. "+584241234567")
        whatsapp_number: {
            type: String,
            trim: true,
        },
        // ID del número de teléfono en Meta for Developers
        phone_number_id: {
            type: String,
            trim: true,
            select: false,
        },
        // WhatsApp Business Account ID
        waba_id: {
            type: String,
            trim: true,
            select: false,
        },
        // Token de acceso permanente (System User Token) para la WhatsApp Business API
        access_token: {
            type: String,
            trim: true,
            select: false,
        },
        // Token de verificación usado por los webhooks de Meta
        verify_token: {
            type: String,
            trim: true,
            select: false,
        },
        // Secreto de la aplicación para verificar firma HMAC (opcional, fallback al .env)
        app_secret: {
            type: String,
            trim: true,
            select: false,
        },
        // ── Telegram MTProto ──────────────────────────────────────────────
        telegram_api_id: {
            type: Number,
            select: false,
        },
        telegram_api_hash: {
            type: String,
            trim: true,
            select: false,
        },
        telegram_session: {
            type: String,
            trim: true,
            select: false,
        },
        telegram_phone: {
            type: String,
            trim: true,
        },
        // ── Estado de Configuración ─────────────────────────────────────────
        isWhatsappConfigured: {
            type: Boolean,
            default: false,
        },
        isTelegramConfigured: {
            type: Boolean,
            default: false,
        },
        // Plataforma predeterminada para el envío de despachos desde VFP
        plataforma_despacho: {
            type: String,
            enum: ['whatsapp', 'telegram'],
            default: 'whatsapp',
        },
        // Proveedor de Inteligencia Artificial
        ai_provider: {
            type: String,
            enum: ['ai_studio', 'vertex_ai'],
            default: 'ai_studio',
        },
        // Flag para activar/desactivar la IA independientemente de si hay API Key
        ia_activa: {
            type: Boolean,
            default: true,
        },
        // Clave de API de Google Gemini para procesamiento de IA individual
        gemini_api_key: {
            type: String,
            trim: true,
            select: false,
        },
        // Prompt del sistema personalizado para el asistente de esta línea
        gemini_prompt: {
            type: String,
            trim: true,
            select: false,
        },
        // Consumo histórico de tokens de entrada (para facturación Vertex AI)
        tokens_input_consumed: {
            type: Number,
            default: 0,
        },
        // Consumo histórico de tokens de salida (para facturación Vertex AI)
        tokens_output_consumed: {
            type: Number,
            default: 0,
        },
        // ── Respuesta Automática ────────────────────────────────────────────
        // Activa el envío automático de un mensaje fijo al cliente (mutuamente excluyente con IA)
        auto_reply_activo: {
            type: Boolean,
            default: false,
        },
        // Texto del mensaje automático que se enviará al cliente
        auto_reply_mensaje: {
            type: String,
            trim: true,
            select: false,
        },
        // Indica si la línea está operativa en el sistema
        activa: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

if (mongoose.models?.Lineas) {
    delete mongoose.models.Lineas;
}
const LineasModel: Model<ILinea> = mongoose.model<ILinea>("Lineas", LineasSchema);

export default LineasModel;
