import mongoose from 'mongoose';
import fs from 'fs';

const MONGODB_URI = 'mongodb+srv://villamizarandresdavid:Shoko.180506@businfotachira.nn3l8.mongodb.net/taximast?retryWrites=true&w=majority&appName=businfotachira';

const ConductoresSchema = new mongoose.Schema({
    nombre: String,
    telefono: String,
    control: String,
    placa: String,
    linea: mongoose.Types.ObjectId,
});

const ConductoresModel = mongoose.model('Conductores', ConductoresSchema);

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Conectado a MongoDB');

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Colecciones:', collections.map(c => c.name));
        const targetPhoneFull = '584247042556';
        const targetLineaId = '69fb5204f56b0285976f887f';

        function getPhoneVariants(phone) {
            let p = phone.replace(/\D/g, '');
            let norm = p;
            if (p.startsWith('58')) norm = p.slice(2);
            else if (p.startsWith('0')) norm = p.slice(1);
            
            return [
                phone,       
                norm,        
                `0${norm}`,  
                `58${norm}`, 
                `+58${norm}` 
            ];
        }

        const variants = getPhoneVariants(targetPhoneFull);
        console.log(`Buscando con variantes: ${JSON.stringify(variants)} y linea: ${targetLineaId}`);

        const all = await ConductoresModel.find({}).lean();
        console.log(`Total conductores en BD: ${all.length}`);
        fs.writeFileSync('scratch/all_conductores.json', JSON.stringify(all, null, 2));
        console.log('Dumping all drivers to scratch/all_conductores.json');

        const result = await ConductoresModel.findOne({
            telefono: { $in: variants },
            linea: new mongoose.Types.ObjectId(targetLineaId)
        }).lean();

        if (result) {
            console.log(`RESULTADO ENCONTRADO: ${result.nombre} (Unit: ${result.control}) (${result._id})`);
        } else {
            console.log('RESULTADO NO ENCONTRADO con la query exacta.');
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

run();
