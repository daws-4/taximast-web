import mongoose from "mongoose";

const MONGODB_URI = "mongodb+srv://villamizarandresdavid:Shoko.180506@businfotachira.nn3l8.mongodb.net/taximast?retryWrites=true&w=majority&appName=businfotachira";

async function fixLinea() {
    try {
        await mongoose.connect(MONGODB_URI);
        const Linea = mongoose.model("Lineas", new mongoose.Schema({}, { strict: false }));
        
        const lineId = "69a7830cc01d88c3bf686d3e";
        
        const result = await Linea.findByIdAndUpdate(lineId, {
            $set: {
                platform: "telegram",
                ia_activa: true
            }
        }, { new: true });

        if (result) {
            console.log("✅ Línea actualizada correctamente:");
            console.log(`- Nombre: ${result.get("name")}`);
            console.log(`- Platform: ${result.get("platform")}`);
            console.log(`- IA Activa: ${result.get("ia_activa")}`);
        } else {
            console.log("❌ No se encontró la línea para actualizar.");
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error("Error:", error);
    }
}

fixLinea();
