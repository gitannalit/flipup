import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp, TrendingDown, BarChart3, MessageSquare,
  Calculator, Bell, FileText, Globe, ArrowRight,
  ChevronRight, Leaf, Shield, Zap
} from "lucide-react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { data: resumen } = trpc.precios.resumenMercado.useQuery();

  const precioActual = resumen?.precioActual ? Number(resumen.precioActual) : null;
  const variacion = resumen?.variacionSemanal ? Number(resumen.variacionSemanal) : null;
  const tendencia = resumen?.tendencia ?? "estable";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
              <Leaf className="w-4 h-4 text-primary" />
            </div>
            <span className="font-display font-bold text-xl text-primary">Olixxia</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#mercado" className="hover:text-foreground transition-colors">Mercado</a>
            <a href="#precios" className="hover:text-foreground transition-colors">Precios</a>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Button onClick={() => navigate("/dashboard")} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                Ir al Dashboard <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <a href="/login">Iniciar sesión</a>
                </Button>
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                  <a href="/login">Acceder gratis</a>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-32 pb-24 px-4 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-primary/8 rounded-full blur-3xl" />
        </div>

        <div className="container relative">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="outline" className="mb-6 border-primary/30 text-primary bg-primary/10 px-4 py-1.5">
              <Zap className="w-3 h-3 mr-1.5" />
              Inteligencia comercial para el sector oleícola
            </Badge>

            <h1 className="text-5xl md:text-7xl font-display font-bold leading-tight mb-6">
              <span className="text-foreground">¿Y si pudieras</span>
              <br />
              <span className="text-primary" style={{ textShadow: "0 0 40px oklch(0.78 0.14 85 / 0.3)" }}>
                anticiparte al mercado
              </span>
              <br />
              <span className="text-foreground">del AOVE?</span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Plataforma de análisis e inteligencia comercial para almazaras, cooperativas y corredores.
              Datos reales del MAPA, IA especializada y calculadora de optimización comercial.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8 py-6 rounded-xl"
                onClick={() => isAuthenticated ? navigate("/dashboard") : navigate("/login")}
              >
                Acceder a la plataforma
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-base px-8 py-6 rounded-xl border-border hover:bg-secondary"
                onClick={() => isAuthenticated ? navigate("/chatbot") : navigate("/login")}
              >
                <MessageSquare className="w-5 h-5 mr-2" />
                Probar AOVE Insights IA
              </Button>
            </div>
          </div>

          {/* Live price ticker */}
          {precioActual && (
            <div id="mercado" className="mt-16 max-w-3xl mx-auto">
              <div className="bg-card border border-border rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground font-medium">Precio AOVE — Mercado España</span>
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                    {resumen?.semanaIso ?? "Semana actual"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary" style={{ textShadow: "0 0 20px oklch(0.78 0.14 85 / 0.3)" }}>
                      {precioActual.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">€/100kg Nacional</div>
                    {variacion !== null && (
                      <div className={`flex items-center justify-center gap-1 mt-1 text-xs font-semibold ${variacion >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {variacion >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {variacion >= 0 ? "+" : ""}{variacion.toFixed(2)}%
                      </div>
                    )}
                  </div>
                  <div className="text-center border-l border-border pl-4">
                    <div className="text-2xl font-bold text-foreground">
                      {resumen?.precioJaen ? Number(resumen.precioJaen).toFixed(2) : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">€/100kg Jaén</div>
                  </div>
                  <div className="text-center border-l border-border pl-4">
                    <div className="text-2xl font-bold text-foreground">
                      {resumen?.precioCórdoba ? Number(resumen.precioCórdoba).toFixed(2) : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">€/100kg Córdoba</div>
                  </div>
                  <div className="text-center border-l border-border pl-4">
                    <div className={`text-lg font-bold ${tendencia === "alcista" ? "text-green-400" : tendencia === "bajista" ? "text-red-400" : "text-yellow-400"}`}>
                      {tendencia === "alcista" ? "↑ Alcista" : tendencia === "bajista" ? "↓ Bajista" : "→ Estable"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Tendencia</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 border-t border-border/50">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold mb-4">Todo lo que necesitas para operar con criterio</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Desde datos de mercado hasta simulaciones de escenarios, Olixxia centraliza la inteligencia comercial del sector oleícola.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: BarChart3,
                title: "Dashboard de Precios",
                desc: "Precios AOVE en tiempo real: nacional, Jaén, Córdoba, Andalucía. Evolución semanal y comparativa interanual.",
                color: "text-primary",
                bg: "bg-primary/10",
                href: "/dashboard",
              },
              {
                icon: MessageSquare,
                title: "AOVE Insights IA",
                desc: "Chatbot especializado con motor intercambiable (GPT-4, Claude, Mistral). Respuestas con datos reales del mercado.",
                color: "text-blue-400",
                bg: "bg-blue-500/10",
                href: "/chatbot",
              },
              {
                icon: Calculator,
                title: "Calculadora Comercial",
                desc: "Simula escenarios de venta/compra. Calcula RRH, margen neto y recibe recomendación estratégica de la IA.",
                color: "text-green-400",
                bg: "bg-green-500/10",
                href: "/calculadora",
              },
              {
                icon: Globe,
                title: "Comparativa Internacional",
                desc: "España vs Italia, Grecia y Túnez. Diferencial de precios y presión exportadora con datos de EU Agridata.",
                color: "text-purple-400",
                bg: "bg-purple-500/10",
                href: "/mercado",
              },
              {
                icon: Bell,
                title: "Alertas de Precio",
                desc: "Configura umbrales personalizados. Recibe notificación por email cuando el mercado alcanza tu precio objetivo.",
                color: "text-yellow-400",
                bg: "bg-yellow-500/10",
                href: "/alertas",
              },
              {
                icon: FileText,
                title: "Gestión de Documentos",
                desc: "Sube boletines MAPA y tus propios datos. El chatbot los usa como contexto adicional para análisis personalizados.",
                color: "text-orange-400",
                bg: "bg-orange-500/10",
                href: "/documentos",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-card border border-border rounded-xl p-6 hover:border-primary/30 transition-all duration-200 cursor-pointer group"
                onClick={() => isAuthenticated ? navigate(feature.href) : navigate("/login")}
              >
                <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4`}>
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
                <div className="flex items-center gap-1 mt-4 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Acceder <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-20 border-t border-border/50 bg-card/30">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "25%", label: "de la producción mundial de AOVE viene de Jaén" },
              { value: "1.3M t", label: "producción anual de aceite de oliva en España" },
              { value: "+350K", label: "explotaciones oleícolas en España" },
              { value: "0.10€/kg", label: "puede cambiar toda la rentabilidad de una campaña" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl font-bold text-primary mb-2">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="precios" className="py-24 border-t border-border/50">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-4xl font-display font-bold mb-4">
              Toma decisiones con datos reales, no con intuición
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              Únete a las cooperativas y almazaras que ya operan con inteligencia de mercado.
              Acceso gratuito durante el periodo de lanzamiento.
            </p>
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-10 py-6 rounded-xl"
              onClick={() => isAuthenticated ? navigate("/dashboard") : navigate("/login")}
            >
              Empezar ahora — es gratis
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/50 py-12">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Leaf className="w-5 h-5 text-primary" />
              <span className="font-display font-bold text-primary">Olixxia</span>
              <span className="text-muted-foreground text-sm ml-2">Inteligencia Comercial AOVE</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Datos: MAPA · EU Agridata · PoolRed · Oleista.com
            </div>
            <div className="text-sm text-muted-foreground">
              © 2025 Olixxia. Jaén, España.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
