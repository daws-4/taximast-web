import mongoose from 'mongoose';
import { config } from 'dotenv';
config();

import LineasModel from '../models/Lineas';

async function main() {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);
        
        const linea = await LineasModel.findOne({ name: 'Taxi pruebas sc' });
        if (!linea) throw new Error("No linea");
        
        console.log("Antes:", { api_id: linea.telegram_api_id, phone: linea.telegram_phone });
        
        linea.telegram_api_id = 34091426;
        linea.telegram_phone = "584120691296";
        linea.telegram_api_hash = "30113306f9edfb0af1b029176627f7d1";
        linea.telegram_session = "12345";
        
        console.log("Modified paths before save:", linea.modifiedPaths());
        await linea.save();
        
        const db = mongoose.connection.db;
        if(!db) throw new Error("no db");
        const verification = await db.collection('lineas').findOne({ _id: linea._id });
        console.log("Verificación directa en Mongo:", {
            telegram_api_id: verification?.telegram_api_id,
            telegram_phone: verification?.telegram_phone,
            telegram_api_hash: verification?.telegram_api_hash,
            telegram_session: verification?.telegram_session
        });
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();
