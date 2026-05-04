import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Calculator, TrendingUp, TrendingDown, Loader2, Info,
  BarChart3, Table, Brain, Download, RefreshCw, Zap
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, Cell, PieChart, Pie
} from "recharts";
import { Streamdown } from "streamdown";

// ─── Color palette ─────────────────────────────────────────────────────────
const C = {
  gold: "oklch(0.78 0.14 85)",
  green: "oklch(0.65 0.18 145)",
  red: "oklch(0.60 0.22 25)",
  yellow: "oklch(0.75 0.16 55)",
  blue: "oklch(0.55 0.14 200)",
  muted: "oklch(0.65 0.04 85)",
  border: "oklch(0.25 0.03 85)",
  card: "oklch(0.16 0.025 85)",
};

const CHART_TOOLTIP_STYLE = {
  contentStyle: { background: C.card, border: `1px solid ${C.border}`, borderRadius: "8px", fontSize: "12px" },
  labelStyle: { color: "oklch(0.95 0.02 85)" },
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number, decimals = 0) =>
  n.toLocaleString("es-ES", { maximumFractionDigits: decimals });
const fmtEur = (n: number) =>
  n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

// ─── Simulation engine (pure, runs on every slider change) ──────────────────
function calcularSimulacion(p: SimParams) {
  const costeTotal = p.costeProduccionKg + p.costeAlmacenamientoMes * p.mesesAlmacenados;
  const precioKg = p.precioActual100kg / 100;

  // Escenario 1: Vender todo ahora
  const e1 = {
    nombre: "Vender ahora",
    precioKg,
    ingreso: p.volumenKg * precioKg,
    beneficio: p.volumenKg * (precioKg - costeTotal),
    margen: precioKg - costeTotal,
    color: C.gold,
  };

  // Escenario 2: Escalonado (60% ahora + 40% en 2 semanas)
  const precio2s = precioKg * (1 + p.escenarioBajada / 100);
  const ingresoE2 = p.volumenKg * 0.6 * precioKg + p.volumenKg * 0.4 * precio2s;
  const e2 = {
    nombre: "Escalonado 60/40",
    precioKg: ingresoE2 / p.volumenKg,
    ingreso: ingresoE2,
    beneficio: ingresoE2 - p.volumenKg * costeTotal,
    margen: ingresoE2 / p.volumenKg - costeTotal,
    color: C.green,
  };

  // Escenario 3: Esperar subida (4 semanas + coste extra)
  const precioSubida = precioKg * (1 + p.escenarioSubida / 100);
  const costeEspera = costeTotal + p.costeAlmacenamientoMes * 1; // 1 mes más
  const e3 = {
    nombre: "Esperar subida",
    precioKg: precioSubida,
    ingreso: p.volumenKg * precioSubida,
    beneficio: p.volumenKg * (precioSubida - costeEspera),
    margen: precioSubida - costeEspera,
    color: C.yellow,
  };

  // Escenario 4: Pesimista (doble bajada)
  const precioPes = precioKg * (1 + p.escenarioBajada * 2 / 100);
  const e4 = {
    nombre: "Pesimista",
    precioKg: precioPes,
    ingreso: p.volumenKg * precioPes,
    beneficio: p.volumenKg * (precioPes - costeTotal),
    margen: precioPes - costeTotal,
    color: C.red,
  };

  const escenarios = [e1, e2, e3, e4];

  // RRH (rentabilidad relativa histórica)
  const rrh = costeTotal > 0 ? ((precioKg - costeTotal) / costeTotal) * 100 : 0;

  // Multiplicador de capital
  const multiplicador = costeTotal > 0 ? precioKg / costeTotal : 1;

  // Break-even (precio mínimo para no perder)
  const breakEven = costeTotal;

  // Evolución temporal (12 semanas proyectadas)
  const evolucionTemporal = Array.from({ length: 13 }, (_, i) => {
    const semana = i;
    const tendenciaLineal = precioKg + (p.escenarioBajada / 100) * precioKg * (semana / 12);
    const tendenciaOptimista = precioKg + (p.escenarioSubida / 100) * precioKg * (semana / 12);
    const beneficioAcum = p.volumenKg * (tendenciaLineal - costeTotal);
    return {
      semana: `S${i}`,
      "Tendencia actual": parseFloat((tendenciaLineal * 100).toFixed(2)),
      "Escenario optimista": parseFloat((tendenciaOptimista * 100).toFixed(2)),
      "Precio actual": parseFloat((precioKg * 100).toFixed(2)),
      beneficioAcum: parseFloat(beneficioAcum.toFixed(0)),
    };
  });

  // Beneficio acumulado por escenario (semana a semana)
  const beneficioAcumulado = Array.from({ length: 13 }, (_, i) => {
    const pct = i / 12;
    return {
      semana: `S${i}`,
      "Vender ahora": parseFloat((e1.beneficio * (i === 0 ? 0 : 1)).toFixed(0)),
      "Escalonado": parseFloat((i <= 2 ? e1.beneficio * 0.6 * (i / 2) : e2.beneficio).toFixed(0)),
      "Esperar subida": parseFloat((i < 4 ? 0 : e3.beneficio * ((i - 4) / 8)).toFixed(0)),
    };
  });

  // Volatilidad simulada (últimas 8 semanas)
  const volatilidad = Array.from({ length: 8 }, (_, i) => {
    const base = precioKg * 100;
    const noise = (Math.sin(i * 1.5) * 0.8 + Math.cos(i * 0.7) * 0.5) * (Math.abs(p.escenarioBajada) / 2);
    return {
      semana: `S-${7 - i}`,
      precio: parseFloat((base + noise).toFixed(2)),
      volatilidad: parseFloat(Math.abs(noise).toFixed(2)),
    };
  });

  return { escenarios, rrh, multiplicador, breakEven, costeTotal, evolucionTemporal, beneficioAcumulado, volatilidad, precioKg };
}

type SimParams = {
  volumenKg: number;
  precioActual100kg: number;
  costeProduccionKg: number;
  costeAlmacenamientoMes: number;
  mesesAlmacenados: number;
  escenarioBajada: number;
  escenarioSubida: number;
};

// ─── Donut KPI ──────────────────────────────────────────────────────────────
function DonutKPI({ value, label, sublabel, color = C.gold }: { value: number; label: string; sublabel?: string; color?: string }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const data = [{ v: pct }, { v: 100 - pct }];
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <PieChart width={112} height={112}>
          <Pie data={data} cx={50} cy={50} innerRadius={36} outerRadius={50} startAngle={90} endAngle={-270} dataKey="v" strokeWidth={0}>
            <Cell fill={color} />
            <Cell fill="oklch(0.20 0.025 85)" />
          </Pie>
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold" style={{ color }}>{value.toFixed(1)}%</span>
        </div>
      </div>
      <div className="text-xs font-semibold text-center mt-1">{label}</div>
      {sublabel && <div className="text-xs text-muted-foreground text-center">{sublabel}</div>}
    </div>
  );
}

// ─── Slider row ─────────────────────────────────────────────────────────────
function SliderRow({ label, value, min, max, step, unit, onChange, color = "text-foreground", format }: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (v: number) => void; color?: string; format?: (v: number) => string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className={`text-sm font-bold ${color}`}>{format ? format(value) : `${fmt(value, step < 1 ? 2 : 0)} ${unit}`}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} className="h-1.5" />
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function Calculadora() {
  const { data: resumen } = trpc.precios.resumenMercado.useQuery();
  const { data: historico } = trpc.precios.historico.useQuery({ categoria: "AOVE", limit: 8 });

  const precioMercado = resumen?.precioActual ? Number(resumen.precioActual) : 871.25;

  const [params, setParams] = useState<SimParams>({
    volumenKg: 50000,
    precioActual100kg: precioMercado,
    costeProduccionKg: 2.60,
    costeAlmacenamientoMes: 0.05,
    mesesAlmacenados: 2,
    escenarioBajada: -2.5,
    escenarioSubida: 2.0,
  });

  const [iaAnalysis, setIaAnalysis] = useState<string | null>(null);
  const [loadingIA, setLoadingIA] = useState(false);
  const [activeTab, setActiveTab] = useState("graficas");

  const calcularMutation = trpc.calculadora.calcular.useMutation({
    onSuccess: (data) => {
      setIaAnalysis(data.recomendacion);
      setLoadingIA(false);
      toast.success("Análisis IA completado");
    },
    onError: (err) => { toast.error(err.message); setLoadingIA(false); },
  });

  const set = useCallback((key: keyof SimParams) => (v: number) =>
    setParams(p => ({ ...p, [key]: v })), []);

  // Recalculate on every param change (pure, instant)
  const sim = useMemo(() => calcularSimulacion(params), [params]);

  const handleGetIA = () => {
    setLoadingIA(true);
    calcularMutation.mutate({
      volumenKg: params.volumenKg,
      precioActualKg: params.precioActual100kg / 100,
      costeProduccionKg: params.costeProduccionKg,
      costeAlmacenamientoMes: params.costeAlmacenamientoMes,
      mesesAlmacenados: params.mesesAlmacenados,
      escenarioBajada: params.escenarioBajada,
      escenarioSubida: params.escenarioSubida,
      guardar: false,
    });
  };

  const handleExportHTML = () => {
    const html = buildHTMLReport(params, sim);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `olixxia-informe-${new Date().toISOString().split("T")[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Informe exportado");
  };

  // Historical price data for chart
  const historicoPrecio = (historico ?? []).slice().reverse().map(p => ({
    semana: p.semanaIso?.replace("2025-", "").replace("2024-", "24-") ?? "",
    precio: Number(p.precioNacional100kg),
  }));

  const rrhColor = sim.rrh > 20 ? C.green : sim.rrh > 5 ? C.gold : C.red;

  return (
    <div className="flex flex-col h-full space-y-0">
      {/* ── Header ── */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-display font-bold flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Calculadora de Optimización Comercial AOVE
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Simulación en tiempo real · Proyección personalizada</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleGetIA} disabled={loadingIA} className="border-border text-xs">
            {loadingIA ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Brain className="w-3 h-3 mr-1" />}
            Análisis IA
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportHTML} className="border-border text-xs">
            <Download className="w-3 h-3 mr-1" />
            Exportar HTML
          </Button>
        </div>
      </div>

      <div className="flex gap-4 pt-4 min-h-0 flex-1">
        {/* ── LEFT PANEL: Parameters ── */}
        <div className="w-64 flex-shrink-0 space-y-4 overflow-y-auto pr-1">
          {/* Operación */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3 h-3" /> La Operación
            </div>
            <SliderRow label="Volumen" value={params.volumenKg} min={1000} max={500000} step={1000} unit="kg"
              onChange={set("volumenKg")} color="text-primary"
              format={(v) => `${(v / 1000).toFixed(0)}k kg`} />
            <SliderRow label="Precio mercado" value={params.precioActual100kg} min={300} max={1200} step={1} unit="€/100kg"
              onChange={set("precioActual100kg")} color="text-primary"
              format={(v) => `${v.toFixed(2)} €`} />
            {resumen?.precioActual && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Precio actual MAPA</span>
                <button onClick={() => set("precioActual100kg")(Number(resumen.precioActual))}
                  className="text-primary hover:underline font-medium">
                  {Number(resumen.precioActual).toFixed(2)} €
                </button>
              </div>
            )}
          </div>

          {/* Costes */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Costes</div>
            <SliderRow label="Coste producción" value={params.costeProduccionKg} min={0.5} max={6} step={0.05} unit="€/kg"
              onChange={set("costeProduccionKg")} format={(v) => `${v.toFixed(2)} €/kg`} />
            <SliderRow label="Almacenamiento/mes" value={params.costeAlmacenamientoMes} min={0} max={0.3} step={0.005} unit="€/kg"
              onChange={set("costeAlmacenamientoMes")} format={(v) => `${v.toFixed(3)} €/kg`} />
            <SliderRow label="Meses en almacén" value={params.mesesAlmacenados} min={0} max={12} step={1} unit="meses"
              onChange={set("mesesAlmacenados")} format={(v) => `${v} mes${v !== 1 ? "es" : ""}`} />
          </div>

          {/* Escenarios */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Escenarios</div>
            <SliderRow label="Bajada estimada" value={params.escenarioBajada} min={-15} max={0} step={0.1} unit="%"
              onChange={set("escenarioBajada")} color="text-red-400"
              format={(v) => `${v.toFixed(1)}%`} />
            <SliderRow label="Subida estimada" value={params.escenarioSubida} min={0} max={15} step={0.1} unit="%"
              onChange={set("escenarioSubida")} color="text-green-400"
              format={(v) => `+${v.toFixed(1)}%`} />
          </div>

          {/* Coste total */}
          <div className="bg-card border border-primary/20 rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">Coste total/kg</div>
            <div className="text-2xl font-bold text-foreground">{sim.costeTotal.toFixed(4)} €</div>
            <div className="text-xs text-muted-foreground mt-1">producción + almacenamiento</div>
            <div className="mt-2 pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground">Break-even</div>
              <div className="text-sm font-semibold text-yellow-400">{(sim.breakEven * 100).toFixed(2)} €/100kg</div>
            </div>
          </div>
        </div>

        {/* ── CENTER: Charts + Tabs ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="bg-secondary border border-border w-fit">
              <TabsTrigger value="graficas" className="text-xs gap-1.5">
                <BarChart3 className="w-3 h-3" /> Gráficas
              </TabsTrigger>
              <TabsTrigger value="tabla" className="text-xs gap-1.5">
                <Table className="w-3 h-3" /> Tabla Detallada
              </TabsTrigger>
              <TabsTrigger value="analisis" className="text-xs gap-1.5">
                <Brain className="w-3 h-3" /> Análisis IA
                {iaAnalysis && <Badge className="bg-primary/20 text-primary border-0 text-xs px-1 py-0 h-4">✓</Badge>}
              </TabsTrigger>
            </TabsList>

            {/* ── GRÁFICAS TAB ── */}
            <TabsContent value="graficas" className="flex-1 mt-3 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Chart 1: Evolución de precio */}
                <Card className="bg-card border-border">
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        📈 Evolución del Precio AOVE
                      </CardTitle>
                      <span className="text-lg font-bold text-primary">{params.precioActual100kg.toFixed(2)} €</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Histórico real + proyección 12 semanas</p>
                  </CardHeader>
                  <CardContent className="pt-0 px-2 pb-3">
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={[
                        ...historicoPrecio.map(p => ({ semana: p.semana, "Histórico": p.precio })),
                        ...sim.evolucionTemporal.slice(1).map(p => ({ semana: p.semana, "Tendencia actual": p["Tendencia actual"], "Escenario optimista": p["Escenario optimista"] })),
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="semana" tick={{ fontSize: 10, fill: C.muted }} />
                        <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: C.muted }} />
                        <Tooltip {...CHART_TOOLTIP_STYLE} />
                        <ReferenceLine x="S0" stroke={C.gold} strokeDasharray="4 2" label={{ value: "Hoy", fill: C.gold, fontSize: 10 }} />
                        <Line type="monotone" dataKey="Histórico" stroke={C.gold} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="Tendencia actual" stroke={C.red} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                        <Line type="monotone" dataKey="Escenario optimista" stroke={C.green} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Chart 2: Beneficio acumulado */}
                <Card className="bg-card border-border">
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        💰 Beneficio Acumulado
                      </CardTitle>
                      <span className="text-lg font-bold text-green-400">{fmtEur(sim.escenarios[0].beneficio)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Proyección por escenario · 12 semanas</p>
                  </CardHeader>
                  <CardContent className="pt-0 px-2 pb-3">
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={sim.beneficioAcumulado}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="semana" tick={{ fontSize: 10, fill: C.muted }} />
                        <YAxis tick={{ fontSize: 10, fill: C.muted }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: number) => [fmtEur(v)]} />
                        <Area type="monotone" dataKey="Vender ahora" stroke={C.gold} fill={`${C.gold}20`} strokeWidth={2} />
                        <Area type="monotone" dataKey="Escalonado" stroke={C.green} fill={`${C.green}15`} strokeWidth={1.5} />
                        <Area type="monotone" dataKey="Esperar subida" stroke={C.yellow} fill={`${C.yellow}10`} strokeWidth={1.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Chart 3: Comparativa escenarios */}
                <Card className="bg-card border-border">
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        📊 Comparativa de Escenarios
                      </CardTitle>
                      <span className="text-lg font-bold" style={{ color: sim.escenarios[0].beneficio > 0 ? C.green : C.red }}>
                        {fmtEur(Math.max(...sim.escenarios.map(e => e.beneficio)))}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Beneficio neto por estrategia</p>
                  </CardHeader>
                  <CardContent className="pt-0 px-2 pb-3">
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={sim.escenarios.map(e => ({ nombre: e.nombre, beneficio: e.beneficio, color: e.color }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="nombre" tick={{ fontSize: 9, fill: C.muted }} />
                        <YAxis tick={{ fontSize: 10, fill: C.muted }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: number) => [fmtEur(v), "Beneficio"]} />
                        <ReferenceLine y={0} stroke={C.muted} strokeDasharray="3 3" />
                        <Bar dataKey="beneficio" radius={[4, 4, 0, 0]}>
                          {sim.escenarios.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Chart 4: Volatilidad */}
                <Card className="bg-card border-border">
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        📉 Volatilidad Semanal
                      </CardTitle>
                      <Badge variant="outline" className={`text-xs ${Math.abs(params.escenarioBajada) > 5 ? "border-red-400/30 text-red-400" : "border-green-400/30 text-green-400"}`}>
                        {Math.abs(params.escenarioBajada) > 5 ? "Zona de riesgo" : "Zona estable"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Desviación de precio · últimas 8 semanas</p>
                  </CardHeader>
                  <CardContent className="pt-0 px-2 pb-3">
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={sim.volatilidad}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="semana" tick={{ fontSize: 10, fill: C.muted }} />
                        <YAxis tick={{ fontSize: 10, fill: C.muted }} />
                        <Tooltip {...CHART_TOOLTIP_STYLE} />
                        <Area type="monotone" dataKey="precio" stroke={C.gold} fill={`${C.gold}15`} strokeWidth={2} name="Precio €/100kg" />
                        <Area type="monotone" dataKey="volatilidad" stroke={C.red} fill={`${C.red}10`} strokeWidth={1} strokeDasharray="3 2" name="Volatilidad" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Bottom comparison cards */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "AL CONTADO (Vender ahora)", e: sim.escenarios[0], highlight: false },
                  { label: "ESCALONADO (Tu caso óptimo)", e: sim.escenarios[1], highlight: true },
                ].map(({ label, e, highlight }) => (
                  <div key={label} className={`bg-card border rounded-xl p-4 ${highlight ? "border-primary/30" : "border-border"}`}>
                    <div className="text-xs text-muted-foreground mb-2">{label}</div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-xs text-muted-foreground">Capital</div>
                        <div className="text-sm font-bold">{fmtEur(params.volumenKg * sim.costeTotal)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Beneficio</div>
                        <div className={`text-sm font-bold ${e.beneficio > 0 ? "text-green-400" : "text-red-400"}`}>
                          {e.beneficio > 0 ? "+" : ""}{fmtEur(e.beneficio)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Multiplicador</div>
                        <div className={`text-sm font-bold ${highlight ? "text-primary" : "text-foreground"}`}>
                          {(e.ingreso / (params.volumenKg * sim.costeTotal)).toFixed(2)}x
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ── TABLA TAB ── */}
            <TabsContent value="tabla" className="mt-3">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Tabla Detallada de Escenarios</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          <th className="text-left py-2 pr-4">Escenario</th>
                          <th className="text-right py-2 pr-4">Precio/kg</th>
                          <th className="text-right py-2 pr-4">Ingreso total</th>
                          <th className="text-right py-2 pr-4">Beneficio</th>
                          <th className="text-right py-2 pr-4">Margen/kg</th>
                          <th className="text-right py-2">RRH</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sim.escenarios.map((e, i) => {
                          const rrh = sim.costeTotal > 0 ? ((e.precioKg - sim.costeTotal) / sim.costeTotal * 100) : 0;
                          return (
                            <tr key={i} className="border-b border-border/50 hover:bg-secondary/20">
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ background: e.color }} />
                                  <span className="font-medium">{e.nombre}</span>
                                </div>
                              </td>
                              <td className="py-3 pr-4 text-right">{(e.precioKg * 100).toFixed(2)} €/100kg</td>
                              <td className="py-3 pr-4 text-right">{fmtEur(e.ingreso)}</td>
                              <td className={`py-3 pr-4 text-right font-semibold ${e.beneficio > 0 ? "text-green-400" : "text-red-400"}`}>
                                {e.beneficio > 0 ? "+" : ""}{fmtEur(e.beneficio)}
                              </td>
                              <td className={`py-3 pr-4 text-right ${e.margen > 0 ? "text-green-400" : "text-red-400"}`}>
                                {e.margen > 0 ? "+" : ""}{e.margen.toFixed(4)} €
                              </td>
                              <td className={`py-3 text-right font-bold ${rrh > 0 ? "text-green-400" : "text-red-400"}`}>
                                {fmtPct(rrh)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Parámetros de la simulación */}
                  <div className="mt-6 pt-4 border-t border-border">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Parámetros de la simulación</div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      {[
                        ["Volumen", `${fmt(params.volumenKg)} kg`],
                        ["Precio mercado", `${params.precioActual100kg.toFixed(2)} €/100kg`],
                        ["Coste producción", `${params.costeProduccionKg.toFixed(4)} €/kg`],
                        ["Almacenamiento", `${params.costeAlmacenamientoMes.toFixed(4)} €/kg/mes`],
                        ["Meses almacenado", `${params.mesesAlmacenados} mes${params.mesesAlmacenados !== 1 ? "es" : ""}`],
                        ["Coste total/kg", `${sim.costeTotal.toFixed(4)} €/kg`],
                        ["Break-even", `${(sim.breakEven * 100).toFixed(2)} €/100kg`],
                        ["Multiplicador capital", `${sim.multiplicador.toFixed(2)}x`],
                        ["Bajada estimada", `${params.escenarioBajada.toFixed(1)}%`],
                      ].map(([k, v]) => (
                        <div key={k} className="bg-secondary/30 rounded-lg p-3">
                          <div className="text-xs text-muted-foreground">{k}</div>
                          <div className="font-semibold mt-0.5">{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── ANÁLISIS IA TAB ── */}
            <TabsContent value="analisis" className="mt-3">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Brain className="w-4 h-4 text-primary" />
                      Análisis IA — Recomendación Estratégica
                    </CardTitle>
                    <Button size="sm" onClick={handleGetIA} disabled={loadingIA} className="bg-primary text-primary-foreground text-xs">
                      {loadingIA ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                      {iaAnalysis ? "Actualizar" : "Generar análisis"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {iaAnalysis ? (
                    <div className="space-y-4">
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
                        <Streamdown className="text-sm text-foreground/90 prose prose-sm prose-invert max-w-none leading-relaxed">
                          {iaAnalysis}
                        </Streamdown>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-secondary/30 rounded-lg p-3">
                          <div className="text-xs text-muted-foreground">Escenario recomendado</div>
                          <div className="font-semibold text-primary mt-1">{sim.escenarios[1].nombre}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">Beneficio: {fmtEur(sim.escenarios[1].beneficio)}</div>
                        </div>
                        <div className="bg-secondary/30 rounded-lg p-3">
                          <div className="text-xs text-muted-foreground">Beneficio máximo posible</div>
                          <div className="font-semibold text-green-400 mt-1">{fmtEur(Math.max(...sim.escenarios.map(e => e.beneficio)))}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">Escenario: {sim.escenarios.find(e => e.beneficio === Math.max(...sim.escenarios.map(x => x.beneficio)))?.nombre}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Brain className="w-8 h-8 text-primary/50" />
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">Sin análisis IA todavía</p>
                        <p className="text-sm text-muted-foreground mt-1">Ajusta los parámetros con los sliders y pulsa "Análisis IA" para obtener una recomendación estratégica personalizada.</p>
                      </div>
                      <Button onClick={handleGetIA} disabled={loadingIA} className="bg-primary text-primary-foreground">
                        {loadingIA ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
                        Generar Análisis IA
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── RIGHT PANEL: KPIs ── */}
        <div className="w-52 flex-shrink-0 space-y-3 overflow-y-auto">
          {/* Donut RRH */}
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center">
            <DonutKPI
              value={Math.min(Math.max(sim.rrh, 0), 100)}
              label="RRH Actual"
              sublabel="Rentabilidad relativa"
              color={rrhColor}
            />
          </div>

          {/* KPI cards */}
          {[
            { label: "Beneficio neto", value: fmtEur(sim.escenarios[0].beneficio), sub: "Vender ahora", color: sim.escenarios[0].beneficio > 0 ? "text-green-400" : "text-red-400" },
            { label: "Ingreso total", value: fmtEur(sim.escenarios[0].ingreso), sub: `${fmt(params.volumenKg)} kg`, color: "text-primary" },
            { label: "Margen/kg", value: `${sim.escenarios[0].margen > 0 ? "+" : ""}${sim.escenarios[0].margen.toFixed(4)} €`, sub: "precio - coste", color: sim.escenarios[0].margen > 0 ? "text-green-400" : "text-red-400" },
            { label: "Multiplicador", value: `${sim.multiplicador.toFixed(2)}x`, sub: "capital invertido", color: "text-yellow-400" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-3">
              <div className="text-xs text-muted-foreground mb-1">{label}</div>
              <div className={`text-base font-bold ${color}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
            </div>
          ))}

          {/* Break-even */}
          <div className="bg-card border border-yellow-500/20 rounded-xl p-3">
            <div className="text-xs text-yellow-400 font-semibold mb-1">🎯 Break-even</div>
            <div className="text-base font-bold text-yellow-400">{(sim.breakEven * 100).toFixed(2)} €</div>
            <div className="text-xs text-muted-foreground">precio mínimo/100kg</div>
            <div className="mt-2 text-xs">
              {params.precioActual100kg > sim.breakEven * 100
                ? <span className="text-green-400">✓ {((params.precioActual100kg / (sim.breakEven * 100) - 1) * 100).toFixed(1)}% por encima</span>
                : <span className="text-red-400">✗ Por debajo del break-even</span>
              }
            </div>
          </div>

          {/* Diferencial internacional */}
          {resumen?.precioItalia && (
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="text-xs text-muted-foreground mb-2">vs Internacional</div>
              <div className="space-y-1.5">
                {[
                  { pais: "🇮🇹 Italia", precio: resumen.precioItalia },
                  { pais: "🇬🇷 Grecia", precio: resumen.precioGrecia },
                ].map(({ pais, precio }) => {
                  if (!precio) return null;
                  const diff = params.precioActual100kg - Number(precio);
                  return (
                    <div key={pais} className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">{pais}</span>
                      <span className={diff > 0 ? "text-red-400" : "text-green-400"}>
                        {diff > 0 ? "+" : ""}{diff.toFixed(0)}€
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── HTML Report builder ────────────────────────────────────────────────────
function buildHTMLReport(params: SimParams, sim: ReturnType<typeof calcularSimulacion>): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Olixxia — Informe Calculadora AOVE</title>
  <style>
    body { font-family: Arial, sans-serif; background: #1a1a0f; color: #f0ede0; padding: 40px; max-width: 900px; margin: 0 auto; }
    h1 { color: #c9a84c; font-size: 24px; margin-bottom: 4px; }
    .subtitle { color: #9a9070; font-size: 14px; margin-bottom: 32px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
    .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 16px; }
    .label { font-size: 11px; color: #9a9070; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
    .value { font-size: 20px; font-weight: 700; }
    .gold { color: #c9a84c; }
    .green { color: #4ade80; }
    .red { color: #f87171; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { text-align: left; padding: 10px 12px; font-size: 11px; color: #9a9070; border-bottom: 1px solid rgba(255,255,255,0.1); }
    td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .footer { margin-top: 40px; text-align: center; color: #6b6850; font-size: 12px; }
  </style>
</head>
<body>
  <h1>🫒 Olixxia — Informe de Calculadora AOVE</h1>
  <div class="subtitle">Generado el ${new Date().toLocaleDateString("es-ES")} · Volumen: ${fmt(params.volumenKg)} kg · Precio: ${params.precioActual100kg.toFixed(2)} €/100kg</div>
  <div class="grid">
    <div class="card"><div class="label">Beneficio neto</div><div class="value ${sim.escenarios[0].beneficio > 0 ? "green" : "red"}">${fmtEur(sim.escenarios[0].beneficio)}</div></div>
    <div class="card"><div class="label">Ingreso total</div><div class="value gold">${fmtEur(sim.escenarios[0].ingreso)}</div></div>
    <div class="card"><div class="label">RRH</div><div class="value ${sim.rrh > 0 ? "green" : "red"}">${sim.rrh.toFixed(1)}%</div></div>
    <div class="card"><div class="label">Multiplicador</div><div class="value gold">${sim.multiplicador.toFixed(2)}x</div></div>
  </div>
  <h2 style="color:#c9a84c;font-size:16px;margin-bottom:8px;">Escenarios Comparativos</h2>
  <table>
    <thead><tr><th>Escenario</th><th>Precio/kg</th><th>Ingreso</th><th>Beneficio</th><th>RRH</th></tr></thead>
    <tbody>
      ${sim.escenarios.map(e => {
        const r = sim.costeTotal > 0 ? ((e.precioKg - sim.costeTotal) / sim.costeTotal * 100) : 0;
        return `<tr><td>${e.nombre}</td><td>${(e.precioKg * 100).toFixed(2)} €/100kg</td><td>${fmtEur(e.ingreso)}</td><td class="${e.beneficio > 0 ? "green" : "red"}">${fmtEur(e.beneficio)}</td><td class="${r > 0 ? "green" : "red"}">${r.toFixed(1)}%</td></tr>`;
      }).join("")}
    </tbody>
  </table>
  <div class="footer">Olixxia — Inteligencia Comercial AOVE · Jaén, España · olixxia.manus.space</div>
</body>
</html>`;
}
