import mongoose, { Document, Model, Schema } from "mongoose";

export interface IContacto extends Document {
    nombre: string;
    telefono: string;
    email: string;
    ubicacion: string;
    detalle_solicitud: string;
    ip_address: string;
    createdAt: Date;
    updatedAt: Date;
}

const ContactosSchema = new mongoose.Schema<IContacto>(
    {
        nombre: {
            type: String,
            required: true,
            trim: true,
        },
        telefono: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            trim: true,
            unique: true, // "no más de un correo electrónico"
        },
        ubicacion: {
            type: String,
            required: true,
            trim: true,
        },
        detalle_solicitud: {
            type: String,
            required: true,
            trim: true,
        },
        ip_address: {
            type: String,
            required: true, // para el límite de cuotas
        },
    },
    { timestamps: true }
);

const ContactosModel: Model<IContacto> =
    mongoose.models?.Contactos || mongoose.model<IContacto>("Contactos", ContactosSchema);

export default ContactosModel;
