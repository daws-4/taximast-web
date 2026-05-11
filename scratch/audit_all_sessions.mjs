import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://villamizarandresdavid:Shoko.180506@businfotachira.nn3l8.mongodb.net/taximast?retryWrites=true&w=majority&appName=businfotachira";

async function auditAllLines() {
    try {
        await mongoose.connect(MONGODB_URI);
        const Linea = mongoose.model("Lineas", new mongoose.Schema({
            telegram_session: { type: String, select: false },
            name: String,
            telegram_phone: String,
            activa: Boolean
        }, { strict: false }));
        
        const lineas = await Linea.find({ activa: true }).select("+telegram_session");
        
        console.log(`Auditoría de ${lineas.length} líneas activas...`);
        const sessions = new Map();
        
        lineas.forEach(l => {
            const sess = l.telegram_session;
            if (!sess) return;
            
            if (sessions.has(sess)) {
                const other = sessions.get(sess);
                console.error(`🚨 DUPLICADO DETECTADO!`);
                console.error(`- Línea 1: ${other.name} (${other._id}) - Tel: ${other.telegram_phone}`);
                console.error(`- Línea 2: ${l.name} (${l._id}) - Tel: ${l.telegram_phone}`);
                console.error(`Ambas comparten la misma sesión. Esto DEBE corregirse.`);
            } else {
                sessions.set(sess, l);
            }
        });

        if (sessions.size === lineas.filter(l => l.telegram_session).length) {
            console.log("✅ No se encontraron sesiones duplicadas entre las líneas activas.");
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error("Error:", error);
    }
}

auditAllLines();
