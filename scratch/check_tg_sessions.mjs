import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://villamizarandresdavid:Shoko.180506@businfotachira.nn3l8.mongodb.net/taximast?retryWrites=true&w=majority&appName=businfotachira";

async function checkSessions() {
    try {
        await mongoose.connect(MONGODB_URI);
        const Linea = mongoose.model("Lineas", new mongoose.Schema({
            telegram_session: { type: String, select: false },
            name: String,
            telegram_phone: String
        }, { strict: false }));
        
        const ids = ["69a7830cc01d88c3bf686d3e", "69fb5204f56b0285976f887f"];
        
        const lineas = await Linea.find({ _id: { $in: ids } }).select("+telegram_session");
        
        console.log("Resultados de la auditoría de sesiones:");
        lineas.forEach(l => {
            console.log(`Línea: ${l.name} (${l._id})`);
            console.log(`Teléfono: ${l.telegram_phone}`);
            console.log(`Sesión (primeros 40 carac): ${l.telegram_session ? l.telegram_session.substring(0, 40) + "..." : "VACÍA"}`);
            console.log("---");
        });

        if (lineas.length === 2 && lineas[0].telegram_session === lineas[1].telegram_session && lineas[0].telegram_session) {
            console.warn("\n⚠️ ALERTA CRÍTICA: Ambas líneas comparten EXACTAMENTE la misma sesión de Telegram.");
            console.warn("Esto causará el error AUTH_KEY_DUPLICATED en una de las dos.");
        } else if (lineas.length === 2) {
            console.log("\n✅ Las sesiones son diferentes.");
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error("Error:", error);
    }
}

checkSessions();
