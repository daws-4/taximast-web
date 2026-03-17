'use client';

import { useState, useEffect } from 'react';
import {
  Monitor,
  Globe,
  Bot,
  Zap,
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
} from 'lucide-react';

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
              <Zap size={20} />
            </div>
            <span>TAXIMAST</span>
          </div>

          {/* Navegación Desktop */}
          <div className="navbar__links">
            <a href="#nosotros" className="navbar__link">Nosotros</a>
            <a href="#servicios" className="navbar__link">Servicios</a>
            <a href="#ecosistema" className="navbar__link">Ecosistema</a>
            <a href="#beneficios" className="navbar__link">Beneficios</a>
            <a href="#atencion" className="navbar__link">Atención</a>
          </div>

          {/* Botones de Auth Desktop */}
          <div className="navbar__auth">
            <button className="navbar__btn-login">
              <User size={16} />
              Iniciar sesión
            </button>
            <button className="navbar__btn-register">
              <UserPlus size={16} />
              Regístrate
            </button>
          </div>

          {/* Toggle Menú Móvil */}
          <button
            className="navbar__mobile-toggle"
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
            <a href="#atencion" onClick={() => setMobileMenuOpen(false)} className="navbar__mobile-link">Atención</a>
            <div className="navbar__mobile-divider" />
            <button className="navbar__mobile-btn-login">
              <User size={20} /> Iniciar sesión
            </button>
            <button className="navbar__mobile-btn-register">
              <UserPlus size={20} /> Regístrate
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
            Descubre el Ecosistema <span className="hero__subtitle-brand">TAXIMAST</span>: La solución definitiva que integra escritorio, web e inteligencia artificial para automatizar tu comunicación por <span className="hero__subtitle-whatsapp">WhatsApp Oficial</span>.
          </p>
          <div className="hero__actions">
            <button className="hero__btn-primary">
              Empezar Ahora
              <ArrowRight size={22} />
            </button>
            <button className="hero__btn-secondary">
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
                En <span className="about__description-brand">TAXIMAST</span>, convertimos lineas tradicionales en empresas tecnológicas de alto rendimiento. Eliminamos las fugas de dinero por mala gestión y devolvemos la autoridad al operador mediante herramientas de IA y monitoreo en tiempo real.
              </p>
              <div className="about__cards">
                <div className="about__card">
                  <Target className="about__card-icon" size={32} />
                  <h4 className="about__card-title">MISIÓN OPERATIVA</h4>
                  <p className="about__card-desc">Sustituir el papel y el radio por un centro de mando digital de alta precisión.</p>
                </div>
                <div className="about__card">
                  <Users className="about__card-icon" size={32} />
                  <h4 className="about__card-title">RESPALDO TAXIMAST</h4>
                  <p className="about__card-desc">Únete a la red de líneas que ya están optimizando sus ingresos con nuestra inteligencia aplicada.</p>
                </div>
              </div>
            </div>
            <div className="about__image-wrapper">
              <div className="about__image-frame">
                <img
                  src="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&q=80&w=800"
                  alt="Equipo TAXIMAST"
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
                title: 'Integración API',
                desc: 'Conexión directa con WhatsApp Business para notificaciones certificadas.',
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
                El Ecosistema TAXIMAST
              </h2>
            </div>
            <p className="ecosystem__subtitle">Sistemas de alto impacto diseñados para escalar.</p>
          </div>

          <div className="ecosystem__grid">
            <div className="eco-card eco-card--desktop">
              <div className="eco-card__icon">
                <Monitor className="text-blue-500" size={32} strokeWidth={2.5} />
              </div>
              <h3 className="eco-card__name">1. TAXIMAST Desktop</h3>
              <p className="eco-card__tag">CORE SYSTEM</p>
              <p className="eco-card__desc">
                Centro de mando local para la gestión masiva de datos. Registra cada kilómetro y cada centavo con precisión quirúrgica.
              </p>
            </div>

            <div className="eco-card eco-card--web">
              <div className="eco-card__icon">
                <Globe className="text-emerald-400" size={32} strokeWidth={2.5} />
              </div>
              <h3 className="eco-card__name">2. TAXIMAST Web</h3>
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
                    src="https://images.unsplash.com/photo-1593950315186-76a92975b60c?auto=format&fit=crop&q=80&w=800"
                    alt="Taxi Blanco Profesional"
                    className="benefits__image"
                  />
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
                  <h4 className="benefits__item-title">Seguridad</h4>
                  <p className="benefits__item-desc">Verificación rigurosa de conductores y evaluación constante de profesionalismo.</p>
                </div>
              </div>

              <div className="benefits__item">
                <div className="benefits__item-icon">
                  <CircleDollarSign size={28} />
                </div>
                <div>
                  <h4 className="benefits__item-title">Precios justos</h4>
                  <p className="benefits__item-desc">Tú tienes el control. Sin tarifas dinámicas abusivas ni cobros sorpresa.</p>
                </div>
              </div>

              <div className="benefits__item">
                <div className="benefits__item-icon">
                  <Sparkles size={28} />
                </div>
                <div>
                  <h4 className="benefits__item-title">Confort y Rapidez</h4>
                  <p className="benefits__item-desc">Lineas moderna y optimización de rutas mediante IA para llegar antes.</p>
                </div>
              </div>

              <div className="benefits__item">
                <div className="benefits__item-icon">
                  <Wallet size={28} />
                </div>
                <div>
                  <h4 className="benefits__item-title">Formas de pago</h4>
                  <p className="benefits__item-desc">Soporte total para Pago Móvil, efectivo y transferencias bancarias nacionales.</p>
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
            <p className="flow__label">Metodología Ágil</p>
            <h2 className="flow__title">Flujo de Notificaciones</h2>
            <div className="flow__accent" />
          </div>

          <div className="flow__timeline">
            <div className="flow__timeline-line" />

            <div className="flow__steps">
              <div className="flow__step">
                <div className="flow__step-circle">
                  1
                </div>
                <h4 className="flow__step-title">Registro</h4>
                <p className="flow__step-desc">Servicio iniciado desde el escritorio central con un clic.</p>
              </div>

              <div className="flow__step">
                <div className="flow__step-circle">
                  2
                </div>
                <h4 className="flow__step-title">Procesamiento</h4>
                <p className="flow__step-desc">Sincronización instantánea y cifrada en la nube.</p>
              </div>

              <div className="flow__step">
                <div className="flow__step-circle">
                  3
                </div>
                <h4 className="flow__step-title">Notificación</h4>
                <p className="flow__step-desc">Alertas push directas a WhatsApp Business oficial.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Atención y Reclamos Section */}
      <section id="atencion" className="contact">
        <div className="contact__inner">
          <div className="contact__header">
            <div className="contact__header-left">
              <div className="contact__header-icon">
                <AlertCircle className="text-black" size={32} />
              </div>
              <h2 className="contact__header-title">Atención y Reclamos</h2>
            </div>
            <p className="contact__header-right">
              Soporte directo <br /> <span>Garantía TAXIMAST</span>
            </p>
          </div>

          <div className="contact__card">
            <div className="contact__card-glow" />

            <form className="contact__form">
              <div className="contact__field">
                <label className="contact__label">Nombre Completo</label>
                <div className="contact__input-wrap">
                  <User className="contact__input-icon" size={18} />
                  <input type="text" placeholder="Tu nombre" className="contact__input" />
                </div>
              </div>

              <div className="contact__field">
                <label className="contact__label">Teléfono</label>
                <div className="contact__input-wrap">
                  <Phone className="contact__input-icon" size={18} />
                  <input type="tel" placeholder="+58 (000) 000-0000" className="contact__input" />
                </div>
              </div>

              <div className="contact__field contact__field--full">
                <label className="contact__label">Ubicación</label>
                <div className="contact__input-wrap">
                  <MapPin className="contact__input-icon" size={18} />
                  <input type="text" placeholder="Ej: San Cristóbal, Táchira" className="contact__input" />
                </div>
              </div>

              <div className="contact__field contact__field--full">
                <label className="contact__label">Detalle del Reporte</label>
                <textarea placeholder="Describe tu situación..." rows={5} className="contact__textarea" />
              </div>

              <button type="button" className="contact__submit">
                Enviar Reporte
                <Send size={22} />
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
              <Zap size={14} />
              <span>TAXIMAST</span>
            </div>
            <span className="footer__brand-divider" />
            <div className="footer__brand-location">
              <MapPin size={12} />
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
