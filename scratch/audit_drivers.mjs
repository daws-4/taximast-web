import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://villamizarandresdavid:Shoko.180506@businfotachira.nn3l8.mongodb.net/taximast?retryWrites=true&w=majority&appName=businfotachira";

async function auditDrivers() {
    try {
        await mongoose.connect(MONGODB_URI);
        const Conductor = mongoose.model("Conductores", new mongoose.Schema({}, { strict: false }));
        const Linea = mongoose.model("Lineas", new mongoose.Schema({}, { strict: false }));
        
        const conductores = await Conductor.find({}).lean();
        const lineas = await Linea.find({}).lean();
        const lineMap = new Map(lineas.map(l => [l._id.toString(), l.name]));

        console.log(`Auditoría de ${conductores.length} conductores...`);
        
        const phoneMap = new Map();
        
        conductores.forEach(c => {
            if (!c.telefono) return;
            const tel = c.telefono.replace(/\D/g, "");
            if (!tel) return;
            
            // Normalizar a últimos 10 dígitos
            const norm = tel.length >= 10 ? tel.slice(-10) : tel;
            
            if (phoneMap.has(norm)) {
                const other = phoneMap.get(norm);
                console.warn(`🚨 DUPLICADO DE TELÉFONO (o variante): ${tel}`);
                console.warn(`- Cond 1: ${other.nombre} | Línea: ${lineMap.get(other.linea?.toString())}`);
                console.warn(`- Cond 2: ${c.nombre} | Línea: ${lineMap.get(c.linea?.toString())}`);
            } else {
                phoneMap.set(norm, c);
            }
        });

        console.log("Auditoría finalizada.");
        await mongoose.disconnect();
    } catch (error) {
        console.error("Error:", error);
    }
}

auditDrivers();
