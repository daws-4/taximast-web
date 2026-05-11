import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const LineasSchema = new mongoose.Schema({
    name: String,
    telegram_session: String,
    telegram_phone: String,
    telegram_api_id: String,
    telegram_api_hash: String
}, { strict: false });

const LineasModel = mongoose.models.Lineas || mongoose.model('Lineas', LineasSchema, 'lineas');

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const lineId = process.argv[2];
        const linea = await LineasModel.findById(lineId).lean();
        
        if (!linea) {
            console.log('Línea no encontrada');
        } else {
            console.log('--- Datos de Telegram ---');
            console.log('ID:', linea._id);
            console.log('Nombre:', linea.name);
            console.log('Teléfono:', linea.telegram_phone);
            console.log('API ID:', linea.telegram_api_id);
            console.log('API Hash:', linea.telegram_api_hash ? '***PRESENTE***' : 'MISSING');
            console.log('Sesión:', linea.telegram_session ? (linea.telegram_session.substring(0, 20) + '...') : 'VACÍA');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

check();
