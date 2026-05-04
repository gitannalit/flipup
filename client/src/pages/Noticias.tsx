import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Newspaper, ExternalLink, Clock } from "lucide-react";

// Noticias de ejemplo (en producción vendrían de NewsAPI via scheduled task)
const NOTICIAS_DEMO = [
  {
    id: 1,
    titulo: "El precio del AOVE sigue bajando en España tras la campaña récord 2024/25",
    descripcion: "La producción histórica de 1,38 millones de toneladas presiona los precios a la baja. Los mercados de Jaén y Córdoba registran descensos consecutivos por cuarta semana.",
    url: "https://www.olimerca.com",
    fuente: "Olimerca",
    publicadoEn: new Date(Date.now() - 2 * 60 * 60 * 1000),
    categoria: "precios",
  },
  {
    id: 2,
    titulo: "España supera el millón de toneladas exportadas de aceite de oliva",
    descripcion: "Las exportaciones españolas de aceite de oliva baten récords históricos, con Italia y EE.UU. como principales destinos. El diferencial de precio con competidores internacionales favorece las ventas.",
    url: "https://www.mapa.gob.es",
    fuente: "MAPA",
    publicadoEn: new Date(Date.now() - 24 * 60 * 60 * 1000),
    categoria: "exportacion",
  },
  {
    id: 3,
    titulo: "La Junta de Andalucía lanza ayudas para modernización de almazaras",
    descripcion: "El programa de modernización dotado con 45 millones de euros busca mejorar la competitividad del sector oleícola andaluz mediante la digitalización y mejora de procesos.",
    url: "https://www.juntadeandalucia.es",
    fuente: "Junta de Andalucía",
    publicadoEn: new Date(Date.now() - 48 * 60 * 60 * 1000),
    categoria: "sector",
  },
  {
    id: 4,
    titulo: "El COI alerta de la presión competitiva de Túnez y Marruecos en mercados europeos",
    descripcion: "El Consejo Oleícola Internacional señala que los productores del norte de África están ganando cuota de mercado en Europa gracias a precios más competitivos, con diferenciales superiores a 80€/100kg.",
    url: "https://www.internationaloliveoil.org",
    fuente: "COI",
    publicadoEn: new Date(Date.now() - 72 * 60 * 60 * 1000),
    categoria: "internacional",
  },
  {
    id: 5,
    titulo: "Infaoliva prevé estabilización de precios en el segundo semestre de 2025",
    descripcion: "La federación de industrias de aceite de oliva española estima que los precios se estabilizarán entre 7,50 y 8,50 €/kg durante el segundo semestre, condicionados por la demanda internacional.",
    url: "https://www.infaoliva.com",
    fuente: "Infaoliva",
    publicadoEn: new Date(Date.now() - 96 * 60 * 60 * 1000),
    categoria: "previsiones",
  },
  {
    id: 6,
    titulo: "PoolRed: volatilidad semanal del AOVE en zona técnica estable",
    descripcion: "Los datos de PoolRed muestran que la volatilidad semanal del aceite de oliva virgen extra se mantiene por debajo del 1,5%, clasificando el mercado en zona de estabilidad técnica.",
    url: "http://www.poolred.com",
    fuente: "PoolRed",
    publicadoEn: new Date(Date.now() - 120 * 60 * 60 * 1000),
    categoria: "analisis",
  },
];

const CATEGORIA_COLORS: Record<string, string> = {
  precios: "text-primary border-primary/30 bg-primary/10",
  exportacion: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  sector: "text-green-400 border-green-400/30 bg-green-400/10",
  internacional: "text-purple-400 border-purple-400/30 bg-purple-400/10",
  previsiones: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  analisis: "text-orange-400 border-orange-400/30 bg-orange-400/10",
};

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Hace menos de 1 hora";
  if (hours < 24) return `Hace ${hours} hora${hours > 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} día${days > 1 ? "s" : ""}`;
}

export default function Noticias() {
  const { data: noticiasDb } = trpc.noticias.listar.useQuery({ limit: 20 });

  // Usar noticias de la BD si hay, si no usar demo
  const noticias = (noticiasDb && noticiasDb.length > 0)
    ? noticiasDb.map(n => ({
        id: n.id,
        titulo: n.titulo,
        descripcion: n.descripcion ?? "",
        url: n.url,
        fuente: n.fuente ?? "Fuente",
        publicadoEn: n.publicadoEn ? new Date(n.publicadoEn) : new Date(),
        categoria: n.categoria ?? "mercado",
      }))
    : NOTICIAS_DEMO;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Newspaper className="w-6 h-6 text-primary" />
          Noticias del Sector
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Últimas noticias sobre el mercado oleícola español e internacional
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {noticias.map((noticia) => (
          <Card key={noticia.id} className="bg-card border-border hover:border-primary/20 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className={`text-xs ${CATEGORIA_COLORS[noticia.categoria] ?? "text-muted-foreground border-border"}`}>
                      {noticia.categoria}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-medium">{noticia.fuente}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeAgo(noticia.publicadoEn)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm mb-2 leading-snug">{noticia.titulo}</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">{noticia.descripcion}</p>
                </div>
                <a
                  href={noticia.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors mt-1"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
