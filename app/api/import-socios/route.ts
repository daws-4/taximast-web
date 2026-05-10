import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { connectDB } from "@/lib/db";
import ConductoresModel from "@/models/Conductores";
import { withAuth, getUserFromRequest } from "@/lib/auth";

/**
 * Script de importación de socios desde CSV.
 * Mapea campos de socios.csv a la colección de Conductores de MongoDB.
 */

// ID de la línea hardcodeado. 
// IMPORTANTE: Cambia este ID por el ID real de la línea a la que pertenecen estos socios.
const LINEA_ID = "69fb5204f56b0285976f887f"; 

async function importHandler(req: NextRequest) {
    try {
        const user = getUserFromRequest(req);
        if (!user || user.rol !== "admin") {
            return NextResponse.json({ ok: false, error: "No autorizado. Solo super admins pueden ejecutar esta ruta." }, { status: 403 });
        }

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
        const errors: any[] = [];

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

        for (let i = 0; i < dataLines.length; i++) {
            const line = dataLines[i];
            if (!line.trim()) continue;

            const fields = parseCSVLine(line);

            if (fields.length < 29) {
                errors.push({ 
                    fila: i + 2, 
                    error: "Campos insuficientes", 
                    datos: line.substring(0, 50) + "..." 
                });
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

            if (!nombre) {
                // REGLA: Si NO tiene nombre, no se carga (aunque tenga teléfono)
                errors.push({ 
                    fila: i + 2, 
                    error: "Importación denegada: Falta Nombre", 
                    telefono_crudo: fields[7] 
                });
                errorCount++;
                continue;
            }

            if (!telefono) {
                // REGLA: Si tiene nombre pero NO tiene teléfono, se reporta pero SE CARGA
                errors.push({ 
                    fila: i + 2, 
                    error: "Aviso: Cargado sin teléfono", 
                    nombre 
                });
            }

            try {
                // Upsert: Usamos la CÉDULA (CODISOCI) como clave única para permitir actualizaciones
                // incluso si el teléfono está vacío o cambia.
                await ConductoresModel.findOneAndUpdate(
                    { linea: LINEA_ID, cedula: cedula },
                    {
                        nombre,
                        cedula,
                        telefono: telefono || undefined,
                        control: unidad || undefined, // Mapeado desde UNIDASIG
                        placa: undefined,
                        notas,
                        activo,
                        linea: LINEA_ID
                    },
                    { upsert: true, returnDocument: 'after' }
                );
                successCount++;
            } catch (err: any) {
                errors.push({ 
                    fila: i + 2, 
                    error: `Error de DB: ${err.message}`, 
                    nombre, 
                    cedula 
                });
                errorCount++;
            }
        }

        return NextResponse.json({
            status: errorCount > 0 ? "partial_success" : "success",
            message: "Proceso de importación finalizado",
            data: {
                total_registros_leidos: dataLines.length,
                importados_con_exito: successCount,
                errores_totales: errorCount,
                lista_errores: errors
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

export const GET = withAuth(importHandler);
