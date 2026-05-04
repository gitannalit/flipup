import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus, RefreshCw, MessageSquare, Calculator } from "lucide-react";
import { useLocation } from "wouter";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from "recharts";
import { toast } from "sonner";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: resumen, isLoading, refetch } = trpc.precios.resumenMercado.useQuery();
  const { data: historico } = trpc.precios.historico.useQuery({ categoria: "AOVE", limit: 12 });
  const { data: internacional } = trpc.precios.internacional.useQuery();
  const seedMutation = trpc.precios.seed.useMutation({
    onSuccess: () => { toast.success("Datos de mercado actualizados"); refetch(); },
    onError: () => toast.error("Error al actualizar datos"),
  });

  const precioActual = resumen?.precioActual ? Number(resumen.precioActual) : null;
  const variacion = resumen?.variacionSemanal ? Number(resumen.variacionSemanal) : 0;
  const tendencia = resumen?.tendencia ?? "estable";

  // Preparar datos para gráfico de evolución
  const chartData = (historico ?? [])
    .slice()
    .reverse()
    .map(p => ({
      semana: p.semanaIso?.replace("2025-", "").replace("2024-", "24-") ?? "",
      precio: Number(p.precioNacional100kg),
      jaen: Number(p.precioJaen100kg),
      cordoba: Number(p.precioCórdoba100kg),
    }));

  // Comparativa internacional (últimas semanas por país)
  const intlData: Record<string, { semana: string; [key: string]: string | number }> = {};
  for (const p of (internacional ?? []).slice(0, 40)) {
    const key = p.semanaIso;
    if (!intlData[key]) intlData[key] = { semana: key.replace("2025-", "").replace("2024-", "24-") };
    const pais = p.pais === "Spain" ? "España" : p.pais === "Italy" ? "Italia" : p.pais === "Greece" ? "Grecia" : p.pais;
    if (!intlData[key][pais]) intlData[key][pais] = Number(p.precio100kg);
  }
  const intlChartData = Object.values(intlData).slice(-8).reverse();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Dashboard de Mercado</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Precios AOVE en tiempo real · {resumen?.semanaIso ?? "Semana actual"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${seedMutation.isPending ? "animate-spin" : ""}`} />
            Actualizar datos
          </Button>
          <Button size="sm" onClick={() => navigate("/chatbot")} className="bg-primary text-primary-foreground">
            <MessageSquare className="w-4 h-4 mr-2" />
            Consultar IA
          </Button>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Precio Nacional AOVE"
          value={precioActual ? `${precioActual.toFixed(2)} €` : "—"}
          sublabel="por 100 kg"
          variacion={variacion}
          highlight
        />
        <MetricCard
          label="Precio Jaén"
          value={resumen?.precioJaen ? `${Number(resumen.precioJaen).toFixed(2)} €` : "—"}
          sublabel="por 100 kg"
        />
        <MetricCard
          label="Precio Córdoba"
          value={resumen?.precioCórdoba ? `${Number(resumen.precioCórdoba).toFixed(2)} €` : "—"}
          sublabel="por 100 kg"
        />
        <MetricCard
          label="Tendencia"
          value={tendencia === "alcista" ? "↑ Alcista" : tendencia === "bajista" ? "↓ Bajista" : "→ Estable"}
          sublabel={`${variacion >= 0 ? "+" : ""}${variacion.toFixed(2)}% esta semana`}
          color={tendencia === "alcista" ? "text-green-400" : tendencia === "bajista" ? "text-red-400" : "text-yellow-400"}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolución semanal */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Evolución Semanal de Precios</CardTitle>
            <p className="text-xs text-muted-foreground">€/100kg — AOVE, Jaén y Córdoba</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 85)" />
                <XAxis dataKey="semana" tick={{ fontSize: 11, fill: "oklch(0.65 0.04 85)" }} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "oklch(0.65 0.04 85)" }} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.16 0.025 85)", border: "1px solid oklch(0.25 0.03 85)", borderRadius: "8px" }}
                  labelStyle={{ color: "oklch(0.95 0.02 85)" }}
                />
                <Legend />
                <Line type="monotone" dataKey="precio" stroke="oklch(0.78 0.14 85)" strokeWidth={2} dot={false} name="Nacional" />
                <Line type="monotone" dataKey="jaen" stroke="oklch(0.65 0.18 145)" strokeWidth={1.5} dot={false} name="Jaén" strokeDasharray="4 2" />
                <Line type="monotone" dataKey="cordoba" stroke="oklch(0.75 0.16 55)" strokeWidth={1.5} dot={false} name="Córdoba" strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Comparativa internacional */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Comparativa Internacional</CardTitle>
            <p className="text-xs text-muted-foreground">€/100kg — España, Italia, Grecia</p>
          </CardHeader>
          <CardContent>
            {intlChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={intlChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 85)" />
                  <XAxis dataKey="semana" tick={{ fontSize: 11, fill: "oklch(0.65 0.04 85)" }} />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "oklch(0.65 0.04 85)" }} />
                  <Tooltip
                    contentStyle={{ background: "oklch(0.16 0.025 85)", border: "1px solid oklch(0.25 0.03 85)", borderRadius: "8px" }}
                  />
                  <Legend />
                  <Bar dataKey="España" fill="oklch(0.78 0.14 85)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Italia" fill="oklch(0.65 0.18 145)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Grecia" fill="oklch(0.75 0.16 55)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <p className="text-sm">Sin datos internacionales</p>
                <Button size="sm" variant="outline" onClick={() => seedMutation.mutate()}>
                  Cargar datos de ejemplo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Diferencial internacional */}
      {resumen && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Diferencial de Precios Internacional</CardTitle>
            <p className="text-xs text-muted-foreground">Ventaja/desventaja competitiva de España frente a otros productores</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { pais: "Italia", precio: resumen.precioItalia, flag: "🇮🇹" },
                { pais: "Grecia", precio: resumen.precioGrecia, flag: "🇬🇷" },
                { pais: "Túnez", precio: resumen.precioTunez, flag: "🇹🇳" },
              ].map(({ pais, precio, flag }) => {
                if (!precio || !precioActual) return null;
                const diff = precioActual - Number(precio);
                const isHigher = diff > 0;
                return (
                  <div key={pais} className="bg-secondary/30 rounded-lg p-4 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{flag} {pais}</span>
                      <span className="text-sm text-muted-foreground">{Number(precio).toFixed(2)} €/100kg</span>
                    </div>
                    <div className={`text-lg font-bold ${isHigher ? "text-red-400" : "text-green-400"}`}>
                      {isHigher ? "+" : ""}{diff.toFixed(2)} €/100kg
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {isHigher ? `España ${diff.toFixed(0)}€ más caro` : `España ${Math.abs(diff).toFixed(0)}€ más barato`}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer"
          onClick={() => navigate("/chatbot")}
        >
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="font-semibold">Consultar AOVE Insights IA</div>
              <div className="text-sm text-muted-foreground">Pregunta sobre el mercado actual y recibe análisis personalizado</div>
            </div>
          </CardContent>
        </Card>
        <Card
          className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer"
          onClick={() => navigate("/calculadora")}
        >
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Calculator className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="font-semibold">Calculadora Comercial</div>
              <div className="text-sm text-muted-foreground">Simula escenarios de venta y calcula tu margen neto óptimo</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  label, value, sublabel, variacion, highlight, color
}: {
  label: string;
  value: string;
  sublabel?: string;
  variacion?: number;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <div className={`bg-card border rounded-xl p-5 relative overflow-hidden ${highlight ? "border-primary/30" : "border-border"}`}>
      {highlight && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-transparent" />
      )}
      <div className="text-xs text-muted-foreground mb-2">{label}</div>
      <div className={`text-2xl font-bold ${color ?? "text-foreground"} ${highlight ? "text-primary" : ""}`}>
        {value}
      </div>
      {sublabel && <div className="text-xs text-muted-foreground mt-1">{sublabel}</div>}
      {variacion !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${variacion > 0 ? "text-green-400" : variacion < 0 ? "text-red-400" : "text-yellow-400"}`}>
          {variacion > 0 ? <TrendingUp className="w-3 h-3" /> : variacion < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          {variacion > 0 ? "+" : ""}{variacion.toFixed(2)}% vs semana anterior
        </div>
      )}
    </div>
  );
}
