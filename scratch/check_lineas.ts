import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const LineaSchema = new mongoose.Schema({
    name: String,
    phone_number_id: String,
    activa: Boolean,
});

async function checkLineas() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || '');
        const Lineas = mongoose.models.Lineas || mongoose.model('Lineas', LineaSchema);
        const allLineas = await Lineas.find({});
        console.log('--- LINEAS EN BASE DE DATOS ---');
        allLineas.forEach(l => {
            console.log(`Nombre: ${l.name} | ID: ${l.phone_number_id} | Activa: ${l.activa}`);
        });
        await mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
}

checkLineas();
