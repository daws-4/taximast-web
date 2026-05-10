import mongoose from 'mongoose';
import { config } from 'dotenv';
config();

import ChatsModel from '../models/Chats';

async function main() {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);
        
        console.log("Sincronizando índices desde el modelo Chats...");
        await ChatsModel.syncIndexes();
        
        console.log("Nuevos índices:");
        const db = mongoose.connection.db;
        if (!db) throw new Error("No db");
        const collection = db.collection('chats');
        console.log(await collection.indexes());
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();
