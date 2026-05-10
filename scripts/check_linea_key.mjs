import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGODB_URI = "mongodb+srv://villamizarandresdavid:Shoko.180506@businfotachira.nn3l8.mongodb.net/taximast?retryWrites=true&w=majority&appName=businfotachira";

async function checkKey() {
    try {
        await mongoose.connect(MONGODB_URI);
        const Linea = mongoose.model("Lineas", new mongoose.Schema({}, { strict: false }));
        
        const lineId = "69a7830cc01d88c3bf686d3e"; // ID del log
        const l = await Linea.findById(lineId);
        
        if (l) {
            console.log(`Línea encontrada: ${l.get("name")}`);
            console.log(`Platform: ${l.get("platform")}`);
            const key = l.get("gemini_api_key");
            console.log(`Key: ${key ? (key.substring(0, 5) + "..." + key.substring(key.length - 5)) : "NO TIENE"}`);
            console.log(`Longitud Key: ${key ? key.length : 0}`);
            console.log(`Activa: ${l.get("ia_activa")}`);
        } else {
            console.log("No se encontró ninguna línea con ese ID.");
            // Listar todas para ver qué hay
            const todas = await Linea.find().limit(5);
            console.log("Primeras 5 líneas en la DB:");
            todas.forEach(t => console.log(`- ${t.get("name")} (Platform: ${t.get("platform")})`));
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error("Error:", error);
    }
}

checkKey();
