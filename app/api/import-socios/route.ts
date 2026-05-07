import { NextResponse } from "next/server";
import fs from "fs";
import { connectDB } from "@/lib/db";
import ConductoresModel from "@/models/Conductores";

/**
 * Script de importación de socios desde CSV.
 * Mapea campos de socios.csv a la colección de Conductores de MongoDB.
 */

// ID de la línea hardcodeado. 
// IMPORTANTE: Cambia este ID por el ID real de la línea a la que pertenecen estos socios.
const LINEA_ID = "663919c7f1a3b1a2c3d4e5f6"; 

export async function GET() {
    try {
        await connectDB();

        // Ruta absoluta al archivo CSV
        const csvPath = "c:\\Users\\USUARIO\\Desktop\\proyectos\\taximast\\web\\linedata\\setur\\socios.csv";
        
        if (!fs.existsSync(csvPath)) {
            return NextResponse.json({ error: "El archivo socios.csv no existe en la ruta especificada." }, { status: 404 });
        }

        const fileContent = fs.readFileSync(csvPath, "utf-8");
        const lines = fileContent.split(/\r?\n/);

        // El encabezado es la primera línea
        // CLAVSOCI,CODISOCI,NOMBSOCI,APELSOCI,SEXO,DIRESOCI,EMAIL,TELESOCI,NACISOCI,FECHNACI,TIPOSANG,EDOCIVIL,FEVELICE,NUMHIJOS,NOMBCONY,FEINCIFA,FEVECFME,APELCONY,FNACCONY,TELFCONY,CARGSOCI,FECHINGR,SALDSOCI,DEPOSITO,OPERSIST,STATSOCIO,OBSESOCI,TARIFA,UNIDASIG,FECHULPA,SERVICIOS
        const dataLines = lines.slice(1);
        
        let successCount = 0;
        let errorCount = 0;
        const processedRows = [];

        // Función simple para parsear una línea de CSV respetando comillas
        const parseCSVLine = (text: string) => {
            const result = [];
            let cur = "";
            let inQuotes = false;
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(cur.trim());
                    cur = "";
                } else {
                    cur += char;
                }
            }
            result.push(cur.trim());
            return result;
        };

        for (const line of dataLines) {
            if (!line.trim()) continue;

            const fields = parseCSVLine(line);

            // Mapeo según la estructura identificada:
            // index 1: CODISOCI (Cédula)
            // index 2: NOMBSOCI (Nombre)
            // index 3: APELSOCI (Apellido)
            // index 7: TELESOCI (Teléfono)
            // index 25: STATSOCIO (Activo si es "1")
            // index 26: OBSESOCI (Notas)
            // index 28: UNIDASIG (Unidad)

            if (fields.length < 29) {
                console.warn(`Línea con campos insuficientes (${fields.length}): ${line}`);
                errorCount++;
                continue;
            }

            const nombre = `${fields[2]} ${fields[3]}`.trim();
            const cedula = fields[1];
            let telefono = fields[7].replace(/\D/g, ""); // Solo números
            const unidad = fields[28] === "0" ? "" : fields[28];
            const notas = fields[26];
            const activo = fields[25] === "1" || fields[25] === "ACTIVO";

            // Formatear teléfono para el sistema (asumiendo +58 si no tiene prefijo)
            if (telefono) {
                if (telefono.startsWith("58")) {
                    telefono = `+${telefono}`;
                } else if (telefono.length === 10) {
                    telefono = `+58${telefono}`;
                } else if (telefono.length > 10 && !telefono.startsWith("+")) {
                    telefono = `+${telefono}`;
                }
            }

            if (!telefono || !nombre) {
                errorCount++;
                continue;
            }

            try {
                // Upsert: Actualiza si existe (por línea y teléfono), crea si no.
                await ConductoresModel.findOneAndUpdate(
                    { linea: LINEA_ID, telefono: telefono },
                    {
                        nombre,
                        cedula,
                        telefono,
                        unidad: unidad || undefined,
                        notas,
                        activo,
                        linea: LINEA_ID
                    },
                    { upsert: true, new: true }
                );
                successCount++;
            } catch (err: any) {
                console.error(`Error importando a ${nombre}:`, err.message);
                errorCount++;
            }
        }

        return NextResponse.json({
            status: "success",
            message: "Proceso de importación finalizado",
            data: {
                total_registros_leidos: dataLines.length,
                importados_con_exito: successCount,
                errores_o_saltados: errorCount
            }
        });

    } catch (error: any) {
        console.error("Error en el script de importación:", error);
        return NextResponse.json({ 
            status: "error", 
            message: error.message 
        }, { status: 500 });
    }
}
