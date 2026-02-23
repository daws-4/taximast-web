import mongoose, { Document, Model } from "mongoose";

export interface ILinea extends Document {
    name: string;
    whatsapp_number: string;
    phone_number_id: string;
    waba_id: string;
    access_token: string;
    verify_token?: string;
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
            required: true,
            type: String,
            trim: true,
        },
        // ID del número de teléfono en Meta for Developers
        phone_number_id: {
            required: true,
            type: String,
            trim: true,
            select: false,
        },
        // WhatsApp Business Account ID
        waba_id: {
            required: true,
            type: String,
            trim: true,
            select: false,
        },
        // Token de acceso permanente (System User Token) para la WhatsApp Business API
        access_token: {
            required: true,
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
        // Indica si la línea está operativa en el sistema
        activa: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

const LineasModel: Model<ILinea> =
    mongoose.models?.Lineas || mongoose.model<ILinea>("Lineas", LineasSchema);

export default LineasModel;
