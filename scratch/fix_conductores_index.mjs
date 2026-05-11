import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function fix() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const db = mongoose.connection.db;
        const collection = db.collection('conductores');
        
        console.log('Eliminando índice antiguo linea_1_cedula_1...');
        try {
            await collection.dropIndex('linea_1_cedula_1');
            console.log('✅ Índice eliminado.');
        } catch (e) {
            console.log('⚠️ El índice no existía o ya fue eliminado.');
        }

        console.log('Recreando índice con partialFilterExpression...');
        await collection.createIndex(
            { linea: 1, cedula: 1 }, 
            { 
                unique: true, 
                name: 'linea_1_cedula_1',
                partialFilterExpression: { cedula: { $type: "string" } } 
            }
        );
        console.log('✅ Índice recreado correctamente.');

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

fix();
