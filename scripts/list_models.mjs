import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("Error: GEMINI_API_KEY no encontrada en el .env");
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Intentar listar modelos usando el cliente oficial
        console.log("Consultando modelos disponibles en Google AI...");
        
        // Nota: La librería de node no tiene un método directo listModels fácil, 
        // pero podemos probar los nombres más comunes uno a uno o usar fetch
        const modelsToTest = [
            "gemini-1.5-flash",
            "gemini-1.5-flash-8b",
            "gemini-1.5-pro",
            "gemini-2.0-flash-exp",
            "gemini-2.0-flash"
        ];

        for (const m of modelsToTest) {
            try {
                const model = genAI.getGenerativeModel({ model: m });
                const result = await model.generateContent("Hola, ¿estás disponible?");
                console.log(`✅ Modelo [${m}]: DISPONIBLE`);
            } catch (err) {
                console.log(`❌ Modelo [${m}]: No disponible (${err.message.split('\n')[0]})`);
            }
        }

    } catch (error) {
        console.error("Error general:", error);
    }
}

listModels();
