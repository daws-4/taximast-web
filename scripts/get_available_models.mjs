import mongoose from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";

const MONGODB_URI = "mongodb+srv://villamizarandresdavid:Shoko.180506@businfotachira.nn3l8.mongodb.net/taximast?retryWrites=true&w=majority&appName=businfotachira";

async function getModels() {
    try {
        await mongoose.connect(MONGODB_URI);
        const Linea = mongoose.model("Lineas", new mongoose.Schema({}, { strict: false }));
        
        // Buscamos la línea de Telegram para usar SU clave
        const linea = await Linea.findById("69a7830cc01d88c3bf686d3e");
        const apiKey = linea?.get("gemini_api_key");

        if (!apiKey) {
            console.error("No se encontró la API Key en la línea.");
            return;
        }

        console.log("Conectando con Google Gemini API...");
        
        // Usamos fetch directo a la API de Google para listar modelos, que es más fiable que la librería para esto
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.models) {
            console.log("\n✅ MODELOS DISPONIBLES PARA TU CLAVE:");
            console.log("--------------------------------------");
            data.models.forEach(m => {
                // Limpiamos el nombre (quitamos el prefijo 'models/')
                const shortName = m.name.replace("models/", "");
                console.log(`- ${shortName} (${m.displayName})`);
            });
            console.log("--------------------------------------");
        } else {
            console.log("❌ No se pudieron obtener los modelos. Respuesta de Google:", data);
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error("Error:", error);
    }
}

getModels();
