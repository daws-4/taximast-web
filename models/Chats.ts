import mongoose, { Document, Model, Schema } from "mongoose";

// Garantizar que los modelos referenciados se registren en Mongoose antes
import "./Lineas";
import "./Operadores";
import "./Conductores";

// ─── Subdocumento: Mensaje ────────────────────────────────────────────────────
export interface IMessage {
    _id: mongoose.Types.ObjectId;
    origen: "cliente" | "operador" | "sistema";
    texto: string;
    timestamp: Date;
    leido: boolean;
    estado?: "pendiente" | "enviado" | "entregado" | "leido" | "fallido";
    tipo?: "text" | "image" | "audio" | "video" | "document" | "location" | "template" | "sticker" | string;
    wa_message_id?: string;
    media_url?: string;
}

const MensajeSchema = new Schema<IMessage>(
    {
        origen: {
            type: String,
            enum: ["cliente", "operador", "sistema"],
            required: true,
        },
        texto: {
            type: String,
            required: true,
            trim: true,
        },
        timestamp: {
            type: Date,
            default: () => new Date(),
        },
        leido: {
            type: Boolean,
            default: false,
        },
        estado: {
            type: String,
            enum: ["pendiente", "enviado", "entregado", "leido", "fallido"],
            default: "pendiente",
        },
        tipo: {
            type: String,
            default: "text",
        },
        media_url: {
            type: String,
        },
        wa_message_id: {
            type: String,
            sparse: true,
        },
    },
    { _id: true }
);

// ─── Documento principal: Chat ────────────────────────────────────────────────
export interface IChat extends Document {
    linea: mongoose.Types.ObjectId;
    operador?: mongoose.Types.ObjectId;
    cliente_phone: string;
    cliente_nombre?: string;
    tipo_chat: "cliente" | "conductor";
    conductor?: mongoose.Types.ObjectId;
    estado: "pendiente" | "bot_atendiendo" | "esperando_operador" | "en_atencion" | "cerrado";
    mensajes: IMessage[];
    ultimoMensaje: Date;
    createdAt: Date;
    updatedAt: Date;
}

const ChatsSchema = new Schema<IChat>(
    {
        // Línea de taxis a la que pertenece esta conversación
        linea: {
            type: Schema.Types.ObjectId,
            ref: "Lineas",
            required: true,
            index: true,
        },
        // Operador que está atendiendo (puede ser null mientras está pendiente)
        operador: {
            type: Schema.Types.ObjectId,
            ref: "Operadores",
            default: null,
        },
        // Número de teléfono del cliente en formato E.164 (+58...)
        cliente_phone: {
            type: String,
            required: true,
            trim: true,
        },
        // Nombre del cliente (si se conoce)
        cliente_nombre: {
            type: String,
            trim: true,
        },
        // Tipo de conversación: cliente o conductor
        tipo_chat: {
            type: String,
            enum: ["cliente", "conductor"],
            default: "cliente",
        },
        // Referencia al conductor (si tipo_chat === "conductor")
        conductor: {
            type: Schema.Types.ObjectId,
            ref: "Conductores",
            default: null,
        },
        // Estado de la conversación
        estado: {
            type: String,
            enum: ["pendiente", "bot_atendiendo", "esperando_operador", "en_atencion", "cerrado"],
            default: "pendiente",
        },
        // Array de mensajes embebido para evitar joins costosos
        mensajes: {
            type: [MensajeSchema],
            default: [],
        },
        // Timestamp del último mensaje para ordenar la lista eficientemente
        ultimoMensaje: {
            type: Date,
            default: () => new Date(),
            index: true,
        },
    },
    { timestamps: true }
);

// Índice compuesto para buscar chats de una línea ordenados por actividad
ChatsSchema.index({ linea: 1, ultimoMensaje: -1 });
// Índice para buscar por número de cliente dentro de una línea
ChatsSchema.index({ linea: 1, cliente_phone: 1 }, { unique: true });

const ChatsModel: Model<IChat> =
    mongoose.models?.Chats || mongoose.model<IChat>("Chats", ChatsSchema);

export default ChatsModel;
