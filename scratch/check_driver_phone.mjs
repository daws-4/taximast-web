import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function checkDriver() {
    await mongoose.connect(MONGODB_URI);
    const C = mongoose.model("Conductores", new mongoose.Schema({}, { strict: false }));

    const phoneFromVFP  = "584247042556"; // lo que envió VFP
    const phoneExpected = "584247053345"; // lo que debería ser

    const [found1, found2] = await Promise.all([
        C.find({ telefono: { $regex: phoneFromVFP.slice(-7) } }).lean(),
        C.find({ telefono: { $regex: phoneExpected.slice(-7) } }).lean(),
    ]);

    console.log(`\n📌 Número que VFP envió (${phoneFromVFP}):`);
    if (found1.length) found1.forEach(c => console.log(`  ✅ Encontrado: ${c.nombre} | Tel: ${c.telefono} | Línea: ${c.linea}`));
    else console.log("  ❌ NO existe en la base de datos.");

    console.log(`\n📌 Número correcto esperado (${phoneExpected}):`);
    if (found2.length) found2.forEach(c => console.log(`  ✅ Encontrado: ${c.nombre} | Tel: ${c.telefono} | Línea: ${c.linea}`));
    else console.log("  ❌ NO existe en la base de datos.");

    await mongoose.disconnect();
}
checkDriver().catch(console.error);
