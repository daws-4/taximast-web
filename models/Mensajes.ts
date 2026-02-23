import mongoose, { Document, Model, Schema } from "mongoose";

// Tipos de mensajes soportados por la WhatsApp Business API
export type TipoMensaje = "text" | "image" | "audio" | "video" | "document" | "location" | "template";

// Estados del mensaje según los webhooks de Meta
export type EstadoMensaje = "pendiente" | "enviado" | "entregado" | "leido" | "fallido";

// Dirección del mensaje respecto a la plataforma
export type DireccionMensaje = "entrante" | "saliente";

export interface IMensaje extends Document {
    linea: mongoose.Types.ObjectId;
    operador?: mongoose.Types.ObjectId;
    wa_message_id: string;
    cliente_numero: string;
    cliente_nombre?: string;
    direccion: DireccionMensaje;
    tipo: TipoMensaje;
    contenido: string;
    media_url?: string;
    estado: EstadoMensaje;
    timestamp_whatsapp: Date;
    createdAt: Date;
    updatedAt: Date;
}

const MensajesSchema = new mongoose.Schema<IMensaje>(
    {
        // Línea de taxis a través de la cual se envió/recibió el mensaje
        linea: {
            type: Schema.Types.ObjectId,
            ref: "Lineas",
            required: true,
        },
        // Operador que gestionó este mensaje (null si entró fuera de turno o de forma automática)
        operador: {
            type: Schema.Types.ObjectId,
            ref: "Operadores",
            default: null,
        },
        // ID único del mensaje asignado por WhatsApp (ej. "wamid.xxx...")
        wa_message_id: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        // Número de WhatsApp del cliente en formato internacional (ej. "584241234567")
        cliente_numero: {
            type: String,
            required: true,
            trim: true,
        },
        // Nombre del perfil de WhatsApp del cliente (obtenido del webhook de Meta)
        cliente_nombre: {
            type: String,
            trim: true,
        },
        // Indica si el mensaje fue recibido del cliente (entrante) o enviado por el operador (saliente)
        direccion: {
            type: String,
            enum: ["entrante", "saliente"],
            required: true,
        },
        // Tipo de contenido del mensaje según la API de WhatsApp Business
        tipo: {
            type: String,
            enum: ["text", "image", "audio", "video", "document", "location", "template"],
            required: true,
            default: "text",
        },
        // Contenido textual del mensaje (o descripción/caption para mensajes multimedia)
        contenido: {
            type: String,
            default: "",
        },
        // URL del archivo multimedia almacenado (imagen, audio, video, documento)
        media_url: {
            type: String,
            trim: true,
        },
        // Estado de entrega del mensaje según los webhooks de Meta
        estado: {
            type: String,
            enum: ["pendiente", "enviado", "entregado", "leido", "fallido"],
            default: "pendiente",
        },
        // Timestamp original del mensaje proveniente de WhatsApp (no el de MongoDB)
        timestamp_whatsapp: {
            type: Date,
            required: true,
        },
    },
    { timestamps: true }
);

// Índices para optimizar consultas frecuentes: historial de un cliente y chats por línea/estado
MensajesSchema.index({ linea: 1, cliente_numero: 1 });
MensajesSchema.index({ linea: 1, estado: 1 });

const MensajesModel: Model<IMensaje> =
    mongoose.models?.Mensajes ||
    mongoose.model<IMensaje>("Mensajes", MensajesSchema);

export default MensajesModel;
