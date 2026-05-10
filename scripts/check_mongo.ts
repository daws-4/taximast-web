import mongoose from 'mongoose';
import { config } from 'dotenv';
config();

import LineasModel from '../models/Lineas';

async function main() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error("❌ Error: MONGODB_URI no está definido en el archivo .env");
        }
        await mongoose.connect(process.env.MONGODB_URI as string);
        
        const lineas = await LineasModel.find({}).select("+telegram_api_id +telegram_phone +telegram_session").lean();
        console.log(JSON.stringify(lineas, null, 2));
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();
