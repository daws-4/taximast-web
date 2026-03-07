import { title, subtitle } from "@/components/primitives";
import { Button } from "@heroui/button";
import { Card, CardHeader, CardBody } from "@heroui/card";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center gap-6 py-20 px-6 text-center">
        <h1 className={title({ size: "lg" })}>
          Bienvenido al futuro de tu <br />
          <span className={`${title({ size: "lg" })} text-saffron`}>Línea de Taxis.</span>
        </h1>
        <p className={`${subtitle({ class: "mt-4 max-w-2xl" })} text-default-600`}>
          Descubre el Ecosistema <strong>TAXIMAST</strong>: La solución definitiva que integra escritorio, web e inteligencia artificial para automatizar tu comunicación por WhatsApp Oficial.
        </p>
        <div className="flex gap-4 mt-4">
          <Button className="bg-saffron text-onyx font-bold" variant="shadow" size="lg" radius="full">
            Empezar Ahora
          </Button>
          <Button className="border-saffron text-saffron" variant="bordered" size="lg" radius="full">
            Saber Más
          </Button>
        </div>
      </section>

      {/* Ecosystem Section */}
      <section className="py-20 px-6 bg-default-50">
        <div className="max-w-7xl mx-auto">
          <h2 className={`${title({ size: "md" })} text-center mb-12 block`}>El Ecosistema TAXIMAST</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1: TAXIMAST Desktop */}
            <Card className="py-4 shadow-lg hover:-translate-y-1 transition-transform bg-background/60 dark:bg-default-100/50 backdrop-blur-md border border-white/20">
              <CardHeader className="pb-0 pt-2 px-4 flex-col items-start gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-platinum/50 dark:bg-jet-black/50 text-onyx dark:text-platinum">
                    💻
                  </span>
                  <h4 className="font-bold text-large">1. TAXIMAST Desktop</h4>
                </div>
                <small className="text-default-500">Centro de Control</small>
              </CardHeader>
              <CardBody className="overflow-visible py-4 mt-2">
                <p className="text-base text-default-700">
                  La aplicación principal de escritorio que sirve como el registrador central de todos los servicios y carreras emitidas por tu línea de taxis. Administra flotas, operadores y servicios desde un solo lugar.
                </p>
              </CardBody>
            </Card>

            {/* Card 2: TAXIMAST Web */}
            <Card className="py-4 shadow-lg hover:-translate-y-1 transition-transform bg-background/60 dark:bg-default-100/50 backdrop-blur-md border border-white/20">
              <CardHeader className="pb-0 pt-2 px-4 flex-col items-start gap-2">
                 <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-platinum/50 dark:bg-jet-black/50 text-onyx dark:text-platinum">
                    🌐
                  </span>
                  <h4 className="font-bold text-large">2. TAXIMAST Web</h4>
                </div>
                <small className="text-default-500">Motor de Comunicación</small>
              </CardHeader>
              <CardBody className="overflow-visible py-4 mt-2">
                <p className="text-base text-default-700">
                  El puente inteligente que conecta el escritorio con la API Oficial de WhatsApp. Se encarga de procesar los datos y enviar notificaciones automáticas tanto al conductor como al cliente, eliminando el envío manual.
                </p>
              </CardBody>
            </Card>

            {/* Card 3: AI Assistant */}
            <Card className="py-4 shadow-lg hover:-translate-y-1 transition-transform bg-bright-gold/5 dark:bg-bright-gold/10 backdrop-blur-md border border-bright-gold/30">
              <CardHeader className="pb-0 pt-2 px-4 flex-col items-start gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-saffron/20 text-saffron">
                    🤖
                  </span>
                  <h4 className="font-bold text-large text-saffron">3. Asistente IA</h4>
                </div>
                <small className="text-default-500">Respuestas Automáticas</small>
              </CardHeader>
              <CardBody className="overflow-visible py-4 mt-2">
                <p className="text-base text-default-700">
                  Sistema inteligente que automatiza la atención inicial. Agiliza la asistencia a los clientes respondiendo consultas sobre la carta de servicios y pre-filtrando solicitudes antes de pasar a los operadores.
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className={`${title({ size: "sm" })} mb-6 block`}>Flujo de Notificaciones Automatizado</h2>
          <p className="text-lg text-default-600 mb-16 max-w-3xl mx-auto">
            Descubre cómo TAXIMAST agiliza las operaciones de tu línea mediante una comunicación perfecta y en tiempo real.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative">
            {/* Step 1 */}
            <div className="flex-1 flex flex-col items-center z-10">
              <div className="w-16 h-16 rounded-full bg-jet-black text-platinum flex items-center justify-center text-2xl font-bold shadow-lg mb-4 border-2 border-platinum/20">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Registro</h3>
              <p className="text-default-500 text-sm">
                El operador emite un servicio desde <strong>TAXIMAST Desktop</strong>.
              </p>
            </div>

            {/* Connector Line (Desktop hidden on mobile) */}
            <div className="hidden md:block absolute top-8 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-platinum via-bright-gold to-saffron -z-0"></div>

            {/* Step 2 */}
            <div className="flex-1 flex flex-col items-center z-10">
              <div className="w-16 h-16 rounded-full bg-saffron text-onyx flex items-center justify-center text-2xl font-bold shadow-lg mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Procesamiento</h3>
              <p className="text-default-500 text-sm">
                Los datos llegan al EndPoint de <strong>TAXIMAST Web</strong> de forma instantánea.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex-1 flex flex-col items-center z-10">
              <div className="w-16 h-16 rounded-full bg-bright-gold text-onyx flex items-center justify-center text-2xl font-bold shadow-lg mb-4 border-2 border-saffron/20">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Notificación</h3>
              <p className="text-default-500 text-sm">
                Se envían mensajes por la <strong>API Oficial de WhatsApp</strong> al chófer y al cliente.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="w-full py-8 text-center text-default-400 bg-background border-t border-divider">
        <p>© {new Date().getFullYear()} TAXIMAST. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
