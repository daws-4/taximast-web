import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const LineasSchema = new mongoose.Schema({}, { strict: false });
const LineasModel = mongoose.models.Lineas || mongoose.model('Lineas', LineasSchema, 'lineas');

async function reset() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const lineId = '69a7830cc01d88c3bf686d3e';
        
        console.log('Limpiando sesión de Telegram para la línea 69a7830cc01d88c3bf686d3e...');
        
        const result = await LineasModel.updateOne(
            { _id: new mongoose.Types.ObjectId(lineId) },
            { $set: { telegram_session: "" } }
        );
        
        if (result.modifiedCount > 0) {
            console.log('✅ Sesión eliminada exitosamente. El sistema pedirá código de nuevo al iniciar.');
        } else {
            console.log('⚠️ No se encontró la línea o la sesión ya estaba vacía.');
        }

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

reset();
