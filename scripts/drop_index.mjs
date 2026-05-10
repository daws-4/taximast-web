import mongoose from 'mongoose';
import { config } from 'dotenv';
config();

async function main() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const db = mongoose.connection.db;
        const collection = db.collection('chats');
        
        console.log("Índices actuales:", await collection.indexes());
        
        try {
            await collection.dropIndex("linea_1_cliente_phone_1");
            console.log("Índice antiguo eliminado correctamente.");
        } catch (e) {
            console.log("El índice linea_1_cliente_phone_1 no existe o ya fue eliminado.", e.message);
        }

        console.log("Sincronizando índices de Mongoose...");
        const ChatsModel = mongoose.model('Chats', new mongoose.Schema({}));
        await ChatsModel.syncIndexes();
        
        console.log("Nuevos índices:", await collection.indexes());
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();
