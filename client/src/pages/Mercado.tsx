import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, TrendingUp, TrendingDown } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";

export default function Mercado() {
  const { data: internacional } = trpc.precios.internacional.useQuery();
  const { data: resumen } = trpc.precios.resumenMercado.useQuery();

  // Agrupar por semana y país
  const byWeek: Record<string, Record<string, number>> = {};
  for (const p of (internacional ?? [])) {
    if (!byWeek[p.semanaIso]) byWeek[p.semanaIso] = {};
    const label = p.pais === "Spain" ? "España" : p.pais === "Italy" ? "Italia" : p.pais === "Greece" ? "Grecia" : p.pais === "Tunisia" ? "Túnez" : p.pais;
    if (!byWeek[p.semanaIso][label]) byWeek[p.semanaIso][label] = Number(p.precio100kg);
  }

  const chartData = Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([semana, precios]) => ({ semana: semana.replace("2025-", "").replace("2024-", "24-"), ...precios }));

  // Últimos precios por país
  const ultimosPorPais: Record<string, { precio: number; semana: string }> = {};
  for (const p of (internacional ?? [])) {
    const label = p.pais === "Spain" ? "España" : p.pais === "Italy" ? "Italia" : p.pais === "Greece" ? "Grecia" : p.pais === "Tunisia" ? "Túnez" : p.pais;
    if (!ultimosPorPais[label] || p.semanaIso > ultimosPorPais[label].semana) {
      ultimosPorPais[label] = { precio: Number(p.precio100kg), semana: p.semanaIso };
    }
  }

  const precioEspana = ultimosPorPais["España"]?.precio ?? Number(resumen?.precioActual ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Globe className="w-6 h-6 text-primary" />
          Mercado Internacional
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Comparativa de precios AOVE: España vs principales países productores · Fuente: EU Agridata
        </p>
      </div>

      {/* Comparativa de precios actuales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { pais: "España", flag: "🇪🇸", color: "border-primary/30 bg-primary/5" },
          { pais: "Italia", flag: "🇮🇹", color: "border-border" },
          { pais: "Grecia", flag: "🇬🇷", color: "border-border" },
          { pais: "Túnez", flag: "🇹🇳", color: "border-border" },
        ].map(({ pais, flag, color }) => {
          const data = ultimosPorPais[pais];
          const diff = data ? data.precio - precioEspana : null;
          const isSpain = pais === "España";
          return (
            <div key={pais} className={`bg-card border rounded-xl p-4 ${color}`}>
              <div className="text-2xl mb-1">{flag}</div>
              <div className="font-semibold text-sm mb-1">{pais}</div>
              <div className={`text-xl font-bold ${isSpain ? "text-primary" : "text-foreground"}`}>
                {data ? `${data.precio.toFixed(2)} €` : "—"}
              </div>
              <div className="text-xs text-muted-foreground">por 100 kg</div>
              {!isSpain && diff !== null && (
                <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${diff > 0 ? "text-red-400" : "text-green-400"}`}>
                  {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  España {diff > 0 ? "+" : ""}{diff.toFixed(2)}€ vs {pais}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Gráfico de evolución internacional */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolución de Precios por País</CardTitle>
          <p className="text-xs text-muted-foreground">€/100kg AOVE — últimas 12 semanas</p>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 85)" />
                <XAxis dataKey="semana" tick={{ fontSize: 11, fill: "oklch(0.65 0.04 85)" }} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "oklch(0.65 0.04 85)" }} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.16 0.025 85)", border: "1px solid oklch(0.25 0.03 85)", borderRadius: "8px" }}
                />
                <Legend />
                <Line type="monotone" dataKey="España" stroke="oklch(0.78 0.14 85)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="Italia" stroke="oklch(0.65 0.18 145)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="Grecia" stroke="oklch(0.75 0.16 55)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="Túnez" stroke="oklch(0.55 0.14 200)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
              Cargando datos internacionales...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Análisis de presión exportadora */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Análisis de Presión Exportadora</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(ultimosPorPais)
              .filter(([pais]) => pais !== "España")
              .map(([pais, data]) => {
                const diff = precioEspana - data.precio;
                const pct = (diff / precioEspana * 100).toFixed(1);
                const nivel = Math.abs(diff) > 80 ? "Alta" : Math.abs(diff) > 40 ? "Moderada" : "Baja";
                const color = nivel === "Alta" ? "text-red-400" : nivel === "Moderada" ? "text-yellow-400" : "text-green-400";
                return (
                  <div key={pais} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <span className="font-medium text-sm">{pais}</span>
                      <div className="text-xs text-muted-foreground">
                        {diff > 0 ? `España ${diff.toFixed(0)}€/100kg más caro` : `España ${Math.abs(diff).toFixed(0)}€/100kg más barato`}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className={`text-xs border-current ${color}`}>
                        Presión {nivel}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">Diferencial: {diff > 0 ? "+" : ""}{diff.toFixed(2)}€</div>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
