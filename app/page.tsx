'use client';

import { useState, useEffect, FormEvent } from 'react';
import {
  Monitor,
  Globe,
  Bot,
  CarTaxiFront,
  ArrowRight,
  ShieldCheck,
  CircleDollarSign,
  Sparkles,
  Wallet,
  Menu,
  X,
  User,
  UserPlus,
  MessageCircle,
  Send,
  AlertCircle,
  MapPin,
  Phone,
  Target,
  Users,
  Cpu,
  Settings,
  Headphones,
  LineChart,
  Mail,
} from 'lucide-react';

import Image from 'next/image';

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    ubicacion: '',
    detalle_solicitud: ''
  });
  const [formStatus, setFormStatus] = useState({ loading: false, success: '', error: '' });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleContactSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormStatus({ loading: true, success: '', error: '' });

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al enviar la solicitud');
      }
      setFormStatus({ loading: false, success: 'Solicitud enviada con éxito', error: '' });
      setFormData({ nombre: '', telefono: '', email: '', ubicacion: '', detalle_solicitud: '' });
    } catch (err: any) {
      setFormStatus({ loading: false, success: '', error: err.message || 'Error desconocido' });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="page-root">
      {/* Navbar */}
      <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
        <div className="navbar__inner">
          {/* Logo */}
          <div className="navbar__logo">
            <div className="navbar__logo-icon">
              <CarTaxiFront size={20} />
            </div>
            <span>T@XINET</span>
          </div>

          {/* Navegación Desktop */}
          <div className="navbar__links">
            <a href="#nosotros" className="navbar__link">Nosotros</a>
            <a href="#servicios" className="navbar__link">Servicios</a>
            <a href="#ecosistema" className="navbar__link">Ecosistema</a>
            <a href="#beneficios" className="navbar__link">Beneficios</a>
          </div>

          {/* Botones de Auth Desktop */}
          <div className="navbar__auth">
            <button onClick={() => document.getElementById('atencion')?.scrollIntoView({ behavior: 'smooth' })} className="navbar__btn-register cursor-pointer">
              <AlertCircle size={16} />
              Más Información
            </button>
          </div>

          {/* Toggle Menú Móvil */}
          <button
            className="navbar__mobile-toggle cursor-pointer"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Menú Móvil Desplegable */}
        <div className={`navbar__mobile-menu ${mobileMenuOpen ? 'navbar__mobile-menu--open' : 'navbar__mobile-menu--closed'}`}>
          <div className="navbar__mobile-list">
            <a href="#nosotros" onClick={() => setMobileMenuOpen(false)} className="navbar__mobile-link">Nosotros</a>
            <a href="#servicios" onClick={() => setMobileMenuOpen(false)} className="navbar__mobile-link">Servicios</a>
            <a href="#ecosistema" onClick={() => setMobileMenuOpen(false)} className="navbar__mobile-link">Ecosistema</a>
            <a href="#beneficios" onClick={() => setMobileMenuOpen(false)} className="navbar__mobile-link">Beneficios</a>
            <div className="navbar__mobile-divider" />
            <button onClick={() => { setMobileMenuOpen(false); document.getElementById('atencion')?.scrollIntoView({ behavior: 'smooth' }); }} className="navbar__mobile-btn-register cursor-pointer">
              <AlertCircle size={20} /> Más Información
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero__glow" style={{ animationDuration: '8s' }} />

        <div className="hero__content">
          <div className="hero__badge">
            <span className="hero__badge-dot">
              <span className="hero__badge-dot-ping"></span>
              <span className="hero__badge-dot-core"></span>
            </span>
            Optimización Garantizada
          </div>
          <h1 className="hero__title">
            Evoluciona tu Línea de Taxis: <br />
            <span className="hero__title-highlight">La tecnología que tus clientes piden, con el control que tú necesitas.</span>
          </h1>
          <p className="hero__subtitle">
            Descubre el Ecosistema <span className="hero__subtitle-brand">T@XINET</span>: La solución definitiva que integra escritorio, web e inteligencia artificial para automatizar tu comunicación por <span className="hero__subtitle-whatsapp">WhatsApp Oficial</span>.
          </p>
          <div className="hero__actions">
            <button className="hero__btn-primary cursor-pointer">
              Empezar Ahora
              <ArrowRight size={22} />
            </button>
            <button className="hero__btn-secondary cursor-pointer">
              Saber Más
            </button>
          </div>
        </div>
      </section>

      {/* Sobre Nosotros Section */}
      <section id="nosotros" className="about">
        <div className="about__grid">
          <div className="about__columns">
            <div className="about__text">
              <div className="about__glow" />
              <h2 className="about__title">Digitaliza tu línea <br /> <span className="about__title-fade">y despacha 3 veces más rápido</span></h2>
              <p className="about__description">
                En <span className="about__description-brand">T@XINET</span>, convertimos lineas tradicionales en empresas tecnológicas de alto rendimiento. Eliminamos las fugas de dinero por mala gestión y devolvemos la autoridad al operador mediante herramientas de IA y monitoreo en tiempo real.
              </p>
              <div className="about__cards">
                <div className="about__card">
                  <Target className="about__card-icon" size={32} />
                  <h4 className="about__card-title">MISIÓN OPERATIVA</h4>
                  <p className="about__card-desc">Sustituir el papel y el radio por un centro de mando digital de alta precisión.</p>
                </div>
                <div className="about__card">
                  <Users className="about__card-icon" size={32} />
                  <h4 className="about__card-title">RESPALDO T@XINET</h4>
                  <p className="about__card-desc">Únete a la red de líneas que ya están optimizando sus ingresos con nuestra inteligencia aplicada.</p>
                </div>
              </div>
            </div>
            <div className="about__image-wrapper">
              <div className="about__image-frame">
                <img
                  src="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&q=80&w=800"
                  alt="Equipo T@XINET"
                  className="about__image"
                />
                <div className="about__image-overlay" />
                <div className="about__stat">
                  <div className="about__stat-number">90%</div>
                  <div className="about__stat-label">menos tiempo de espera</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Servicios Section */}
      <section id="servicios" className="services">
        <div className="services__inner">
          <div className="services__header">
            <p className="services__label">Nuestras Soluciones</p>
            <h2 className="services__title">Servicios Especializados</h2>
            <div className="services__accent" />
          </div>

          <div className="services__grid">
            {[
              {
                icon: <Cpu size={32} />,
                title: 'Automatización',
                desc: 'La IA gestiona el proceso masivo de datos, mientras que los operadores se encargan de la supervición y decisiones estratégicas.',
              },
              {
                icon: <Settings size={32} />,
                title: 'Integración API Oficial',
                desc: 'Evita el riesgo de bloqueo de WhatsApp gracias al uso de la aplicación de integración oficial de Whatsapp.',
              },
              {
                icon: <Headphones size={32} />,
                title: 'Soporte 24/7',
                desc: 'Asistencia técnica personalizada para garantizar que su línea nunca se detenga.',
              },
            ].map((service, i) => (
              <div key={i} className="services__card">
                <div className="services__card-icon">
                  {service.icon}
                </div>
                <h3 className="services__card-name">{service.title}</h3>
                <p className="services__card-desc">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ecosistema Section */}
      <section id="ecosistema" className="ecosystem">
        <div className="ecosystem__inner">
          <div className="ecosystem__header">
            <div>
              <p className="ecosystem__label">Integración Total</p>
              <h2 className="ecosystem__title">
                El Ecosistema T@XINET
              </h2>
            </div>
            <p className="ecosystem__subtitle">Sistemas de alto impacto diseñados para escalar.</p>
          </div>

          <div className="ecosystem__grid">
            <div className="eco-card eco-card--desktop">
              <div className="eco-card__icon">
                <Monitor className="text-blue-500" size={32} strokeWidth={2.5} />
              </div>
              <h3 className="eco-card__name">1. T@XINET Desktop</h3>
              <p className="eco-card__tag">CORE SYSTEM</p>
              <p className="eco-card__desc">
                Centro de mando local para la gestión masiva de datos. Registra cada kilómetro y cada centavo con precisión quirúrgica.
              </p>
            </div>

            <div className="eco-card eco-card--web">
              <div className="eco-card__icon">
                <Globe className="text-emerald-400" size={32} strokeWidth={2.5} />
              </div>
              <h3 className="eco-card__name">2. T@XINET Web</h3>
              <p className="eco-card__tag">CLOUD SYNC</p>
              <p className="eco-card__desc">
                El motor de conexión global que escala tu operación. Sincronización en tiempo real con la API de WhatsApp Business.
              </p>
            </div>

            <div className="eco-card eco-card--ai">
              <div className="eco-card__live-dot">
                <span className="eco-card__live-ping">
                  <span className="eco-card__live-ping-ring"></span>
                  <span className="eco-card__live-ping-dot"></span>
                </span>
              </div>
              <div className="eco-card__icon">
                <Bot className="text-yellow-400" size={32} strokeWidth={2.5} />
              </div>
              <h3 className="eco-card__name">3. Asistente IA</h3>
              <p className="eco-card__tag">SMART AGENT</p>
              <p className="eco-card__desc">
                Tu recepcionista 24/7. Resuelve dudas, agenda servicios y filtra prospectos sin intervención humana.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Beneficios Section */}
      <section id="beneficios" className="benefits">
        <div className="benefits__inner">
          <div className="benefits__header">
            <h2 className="benefits__title">Beneficios</h2>
            <div className="benefits__accent" />
          </div>

          <div className="benefits__columns">
            {/* Imagen de Taxi */}
            <div className="benefits__image-area">
              <div className="benefits__image-circle">
                <div className="benefits__image-frame">
                  <img
                    src="https://images.unsplash.com/photo-1610886023290-6ba32b20e354?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                    alt="Equipo T@XINET"
                    className="benefits__image"
                  />
                  <div className="benefits__image-overlay" />
                </div>
                {/* Iconos flotantes decorativos */}
                <div className="benefits__float-icon--whatsapp" style={{ animationDuration: '4s' }}>
                  <MessageCircle size={28} className="text-black fill-current" />
                </div>
                <div className="benefits__float-icon--shield">
                  <ShieldCheck size={32} className="text-white" />
                </div>
              </div>
            </div>

            <div className="benefits__list">
              <div className="benefits__item">
                <div className="benefits__item-icon">
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <h4 className="benefits__item-title">Protección Anti-Bloqueos</h4>
                  <p className="benefits__item-desc">Integración directa con la API Oficial de Meta. Evita suspensiones y garantiza que tu número principal nunca se caiga.</p>
                </div>
              </div>

              <div className="benefits__item">
                <div className="benefits__item-icon">
                  <Bot size={28} />
                </div>
                <div>
                  <h4 className="benefits__item-title">Automatización Inteligente</h4>
                  <p className="benefits__item-desc">La IA atiende múltiples solicitudes de forma simultánea las 24 horas. Cero llamadas perdidas, cero demoras.</p>
                </div>
              </div>

              <div className="benefits__item">
                <div className="benefits__item-icon">
                  <Globe size={28} />
                </div>
                <div>
                  <h4 className="benefits__item-title">Gestión en la Nube</h4>
                  <p className="benefits__item-desc">Sincronización en tiempo real. Supervisa tu operación completa desde cualquier smartphone, tablet o computadora.</p>
                </div>
              </div>

              <div className="benefits__item">
                <div className="benefits__item-icon">
                  <LineChart size={28} />
                </div>
                <div>
                  <h4 className="benefits__item-title">Métricas Exactas</h4>
                  <p className="benefits__item-desc">Obtén reportes detallados del rendimiento operativo, flujo de clientes e ingresos para tomar mejores decisiones logísticas.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Flujo Section */}
      <section id="flujo" className="flow">
        <div className="flow__inner">
          <div className="flow__header">
            <p className="flow__label">Ciclo de Operaciones</p>
            <h2 className="flow__title">Procesamiento de Solicitudes</h2>
            <div className="flow__accent" />
          </div>

          <div className="flow__timeline">
            <div className="flow__timeline-line" />

            <div className="flow__steps">
              <div className="flow__step">
                <div className="flow__step-circle">
                  1
                </div>
                <h4 className="flow__step-title">Recepción y Filtro IA</h4>
                <p className="flow__step-desc">El cliente solicita un taxi por nuestro WhatsApp Oficial. La IA analiza e interpreta el mensaje instantáneamente, agilizando el proceso inicial.</p>
              </div>

              <div className="flow__step">
                <div className="flow__step-circle">
                  2
                </div>
                <h4 className="flow__step-title">Asignación Central</h4>
                <p className="flow__step-desc">El operador de turno visualiza el chat estructurado en el panel web o desktop, donde despacha y asigna la unidad físicamente disponible.</p>
              </div>

              <div className="flow__step">
                <div className="flow__step-circle">
                  3
                </div>
                <h4 className="flow__step-title">Despacho Biométrico</h4>
                <p className="flow__step-desc">El sistema envía automáticamente los datos de la unidad y la fotografía del conductor al WhatsApp del cliente como medida de seguridad.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Más Información Section */}
      <section id="atencion" className="contact">
        <div className="contact__inner">
          <div className="contact__header">
            <div className="contact__header-left">
              <div className="contact__header-icon">
                <AlertCircle className="text-black" size={32} />
              </div>
              <h2 className="contact__header-title">Más Información</h2>
            </div>
            <p className="contact__header-right">
              Soporte directo <br /> <span>Garantía T@XINET</span>
            </p>
          </div>

          <div className="contact__card">
            <div className="contact__card-glow" />

            <form className="contact__form" onSubmit={handleContactSubmit}>
              {formStatus.success && (
                <div className="contact__field--full w-full col-span-full bg-green-100 text-green-800 p-3 rounded-md mb-4 text-sm font-medium border border-green-200" style={{ gridColumn: '1 / -1' }}>
                  {formStatus.success}
                </div>
              )}
              {formStatus.error && (
                <div className="contact__field--full w-full col-span-full bg-red-100 text-red-800 p-3 rounded-md mb-4 text-sm font-medium border border-red-200" style={{ gridColumn: '1 / -1' }}>
                  {formStatus.error}
                </div>
              )}

              <div className="contact__field">
                <label className="contact__label">Nombre Completo</label>
                <div className="contact__input-wrap">
                  <User className="contact__input-icon" size={18} />
                  <input type="text" name="nombre" value={formData.nombre} onChange={handleInputChange} placeholder="Tu nombre" className="contact__input" required />
                </div>
              </div>

              <div className="contact__field">
                <label className="contact__label">Teléfono</label>
                <div className="contact__input-wrap">
                  <Phone className="contact__input-icon" size={18} />
                  <input type="tel" name="telefono" value={formData.telefono} onChange={handleInputChange} placeholder="+58 (000) 000-0000" className="contact__input" required />
                </div>
              </div>

              <div className="contact__field contact__field--full">
                <label className="contact__label">Correo Electrónico</label>
                <div className="contact__input-wrap">
                  <Mail className="contact__input-icon" size={18} />
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="tu@correo.com" className="contact__input" required />
                </div>
              </div>

              <div className="contact__field contact__field--full">
                <label className="contact__label">Ubicación</label>
                <div className="contact__input-wrap">
                  <MapPin className="contact__input-icon" size={18} />
                  <input type="text" name="ubicacion" value={formData.ubicacion} onChange={handleInputChange} placeholder="Ej: San Cristóbal, Táchira" className="contact__input" required />
                </div>
              </div>

              <div className="contact__field contact__field--full">
                <label className="contact__label">Detalle de la Solicitud</label>
                <textarea name="detalle_solicitud" value={formData.detalle_solicitud} onChange={handleInputChange} placeholder="Describe tus dudas y te responderemos lo antes posible..." rows={5} className="contact__textarea" required />
              </div>

              <button type="submit" disabled={formStatus.loading} className="contact__submit cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed">
                {formStatus.loading ? 'Enviando...' : 'Enviar Solicitud'}
                {!formStatus.loading && <Send size={22} />}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer__inner">
          {/* Marca y Ubicación */}
          <div className="footer__brand">
            <div className="footer__brand-name">
              <CarTaxiFront size={20} />
              <span>T@XINET</span>
            </div>
            <span className="footer__brand-divider" />
            <div className="footer__brand-location">
              <MapPin size={20} />
              <span>Venezuela</span>
            </div>
          </div>

          {/* Copyright */}
          <p className="footer__copyright">
            © 2026 Todos los derechos reservados <span className="footer__copyright-extra">| Desarrollado para el futuro</span>
          </p>

          {/* Enlaces Legales */}
          <div className="footer__legal">
            <a href="#" className="footer__legal-link">Privacidad</a>
            <a href="#" className="footer__legal-link">Términos</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
