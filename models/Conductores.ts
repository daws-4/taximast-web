import mongoose, { Document, Model, Schema } from "mongoose";

// Garantizar que el modelo referenciado se registre
import "./Lineas";

export interface IConductor extends Document {
    linea: mongoose.Types.ObjectId;
    nombre: string;
    cedula?: string;
    telefono: string;
    unidad?: string;
    foto_identificacion?: string;
    activo: boolean;
    notas?: string;
    createdAt: Date;
    updatedAt: Date;
}

const ConductoresSchema = new mongoose.Schema<IConductor>(
    {
        // Línea de taxis a la que pertenece este conductor
        linea: {
            type: Schema.Types.ObjectId,
            ref: "Lineas",
            required: true,
            index: true,
        },
        // Nombre completo del conductor
        nombre: {
            type: String,
            required: true,
            trim: true,
        },
        // Cédula de identidad
        cedula: {
            type: String,
            trim: true,
        },
        // Número de WhatsApp del conductor (formato E.164)
        telefono: {
            type: String,
            required: true,
            trim: true,
        },
        // Número o placa de la unidad asignada
        unidad: {
            type: String,
            trim: true,
        },
        // URL de la imagen de identificación del conductor
        foto_identificacion: {
            type: String,
        },
        // Si el conductor está activo en la línea
        activo: {
            type: Boolean,
            default: true,
        },
        // Notas internas del operador
        notas: {
            type: String,
            trim: true,
        },
    },
    { timestamps: true }
);

// Índice compuesto: un teléfono solo puede estar una vez por línea
ConductoresSchema.index({ linea: 1, telefono: 1 }, { unique: true });
// Índice para listar conductores activos de una línea
ConductoresSchema.index({ linea: 1, activo: 1 });

if (mongoose.models?.Conductores) {
    delete mongoose.models.Conductores;
}
const ConductoresModel: Model<IConductor> = mongoose.model<IConductor>("Conductores", ConductoresSchema);

export default ConductoresModel;
