import mongoose from 'mongoose';
import { config } from 'dotenv';
config();

async function main() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const db = mongoose.connection.db;
        const collection = db.collection('lineas');
        
        const lineas = await collection.find({}).toArray();
        console.log(JSON.stringify(lineas, null, 2));
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();
