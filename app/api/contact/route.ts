import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import ContactosModel from '@/models/Contactos';

export async function POST(req: Request) {
    try {
        await connectDB();
        
        const body = await req.json();
        const { nombre, telefono, email, ubicacion, detalle_solicitud } = body;
        
        // Obtener la IP address
        // En Next.js app router, la IP se puede obtener de los headers
        const forwardedFor = req.headers.get('x-forwarded-for');
        const realIp = req.headers.get('x-real-ip');
        let ip_address = 'unknown';
        if (forwardedFor) {
            ip_address = forwardedFor.split(',')[0].trim();
        } else if (realIp) {
            ip_address = realIp;
        }

        // Validaciones requeridas
        if (!nombre || !telefono || !email || !ubicacion || !detalle_solicitud) {
            return NextResponse.json({ success: false, message: 'Todos los campos son obligatorios' }, { status: 400 });
        }

        // Validación: "no más de un correo electrónico"
        const existingEmail = await ContactosModel.findOne({ email });
        if (existingEmail) {
            return NextResponse.json({ success: false, message: 'Ya se ha enviado una solicitud con este correo electrónico' }, { status: 400 });
        }

        // Validación: "no más de tres por la misma dirección IP"
        if (ip_address !== 'unknown') {
            const ipCount = await ContactosModel.countDocuments({ ip_address });
            if (ipCount >= 3) {
                 return NextResponse.json({ success: false, message: 'Has superado el límite de solicitudes desde esta dirección IP' }, { status: 429 });
            }
        }

        const newContacto = new ContactosModel({
            nombre,
            telefono,
            email,
            ubicacion,
            detalle_solicitud,
            ip_address
        });
        
        await newContacto.save();
        
        return NextResponse.json({ success: true, message: 'Solicitud enviada correctamente' }, { status: 201 });
        
    } catch (error: any) {
        console.error('Error en el endpoint de contacto:', error);
        return NextResponse.json({ success: false, message: 'Error interno del servidor' }, { status: 500 });
    }
}
