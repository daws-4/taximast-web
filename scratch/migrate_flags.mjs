import { connectDB } from './lib/db';
import LineasModel from './models/Lineas';
import mongoose from 'mongoose';

async function migrate() {
    await connectDB();
    const lineas = await LineasModel.find({});
    console.log(`Migrando ${lineas.length} líneas...`);

    for (const linea of lineas) {
        const isWA = Boolean(linea.whatsapp_number && linea.phone_number_id && linea.access_token);
        const isTG = Boolean(linea.telegram_api_id && linea.telegram_api_hash);
        
        linea.isWhatsappConfigured = isWA;
        linea.isTelegramConfigured = isTG;
        
        await linea.save();
        console.log(`Línea ${linea.name} actualizada: WA=${isWA}, TG=${isTG}`);
    }
    console.log('Migración completada');
    process.exit(0);
}

migrate().catch(err => {
    console.error(err);
    process.exit(1);
});
