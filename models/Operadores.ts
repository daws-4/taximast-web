import mongoose, { Document, Model, Schema } from "mongoose";

export interface IOperador extends Document {
    linea: mongoose.Types.ObjectId;
    nombre: string;
    apellido: string;
    username: string;
    email?: string;
    password: string;
    rol: "admin" | "operador";
    status: "en_linea" | "turno_abierto" | "ocupado" | "fuera_de_turno";
    genero: "M" | "F";
    createdAt: Date;
    updatedAt: Date;
}

const OperadoresSchema = new mongoose.Schema<IOperador>(
    {
        // Línea de taxis a la que pertenece este operador
        linea: {
            type: Schema.Types.ObjectId,
            ref: "Lineas",
            required: true,
        },
        // Datos personales del operador (recepcionista)
        nombre: {
            type: String,
            required: true,
            trim: true,
        },
        apellido: {
            type: String,
            required: true,
            trim: true,
        },
        // Nombre de usuario único para iniciar sesión en la plataforma
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        // Correo electrónico opcional
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        // Contraseña hasheada (bcrypt)
        password: {
            type: String,
            required: true,
        },
        // Nivel de permisos dentro del sistema
        rol: {
            type: String,
            enum: ["admin", "operador", "admin_linea"],
            default: "operador",
        },
        // Estado actual del operador dentro de la plataforma (para rastrear carga de trabajo)
        status: {
            type: String,
            enum: ["en_linea", "turno_abierto", "ocupado", "fuera_de_turno"],
            default: "fuera_de_turno",
        },
        genero: {
            type: String,
            enum: ["M", "F"],
            default: "M",
        },
    },
    { timestamps: true }
);

if (mongoose.models?.Operadores) {
    delete mongoose.models.Operadores;
}
const OperadoresModel: Model<IOperador> = mongoose.model<IOperador>("Operadores", OperadoresSchema);

export default OperadoresModel;
