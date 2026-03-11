import mongoose from 'mongoose';
import { connectDB } from './lib/db';
import ChatsModel from './models/Chats';
import ConductoresModel from './models/Conductores';

async function main() {
    await connectDB();
    const chats = await ChatsModel.find().lean();
    console.log("CHATS:");
    chats.forEach(c => {
        console.log(`- ID: ${c._id}, cliente_phone: ${c.cliente_phone}, tipo_chat: ${c.tipo_chat}, conductor: ${c.conductor}`);
    });

    const conductores = await ConductoresModel.find().lean();
    console.log("\nCONDUCTORES:");
    conductores.forEach(c => {
        console.log(`- ID: ${c._id}, nombre: ${c.nombre}, telefono: ${c.telefono}`);
    });

    process.exit(0);
}

main();
