import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, TrendingUp, Package } from "lucide-react";

export default function MisVentas() {
  const utils = trpc.useUtils();
  const { data: ventas, isLoading } = trpc.ventas.listar.useQuery();
  const { data: resumen } = trpc.precios.resumenMercado.useQuery();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    fechaVenta: new Date().toISOString().split("T")[0],
    provincia: "Jaén",
    categoria: "AOVE" as "AOVE" | "AOV" | "AOL" | "AOR",
    volumenKg: 10000,
    precioVentaKg: 8.71,
    canalVenta: "granel" as "granel" | "exportacion" | "embotellado" | "cooperativa" | "otro",
    observaciones: "",
  });

  const crearMutation = trpc.ventas.crear.useMutation({
    onSuccess: () => { toast.success("Venta registrada"); utils.ventas.listar.invalidate(); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const eliminarMutation = trpc.ventas.eliminar.useMutation({
    onSuccess: () => { toast.success("Venta eliminada"); utils.ventas.listar.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const totalKg = ventas?.reduce((s, v) => s + Number(v.volumenKg), 0) ?? 0;
  const totalEur = ventas?.reduce((s, v) => s + Number(v.volumenKg) * Number(v.precioVentaKg), 0) ?? 0;
  const precioMercado = resumen?.precioActual ? Number(resumen.precioActual) / 100 : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Mis Ventas</h1>
          <p className="text-muted-foreground text-sm mt-1">Registro de operaciones de venta propias</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground"><Plus className="w-4 h-4 mr-2" />Nueva Venta</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Registrar Venta</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Fecha</Label><Input type="date" value={form.fechaVenta} onChange={e => setForm(f => ({ ...f, fechaVenta: e.target.value }))} className="bg-secondary border-border mt-1" /></div>
                <div><Label>Provincia</Label><Input value={form.provincia} onChange={e => setForm(f => ({ ...f, provincia: e.target.value }))} className="bg-secondary border-border mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Categoría</Label>
                  <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v as typeof form.categoria }))}>
                    <SelectTrigger className="bg-secondary border-border mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="AOVE">AOVE</SelectItem><SelectItem value="AOV">AOV</SelectItem><SelectItem value="AOL">AOL</SelectItem><SelectItem value="AOR">AOR</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Canal</Label>
                  <Select value={form.canalVenta} onValueChange={v => setForm(f => ({ ...f, canalVenta: v as typeof form.canalVenta }))}>
                    <SelectTrigger className="bg-secondary border-border mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="granel">Granel</SelectItem>
                      <SelectItem value="exportacion">Exportación</SelectItem>
                      <SelectItem value="embotellado">Embotellado</SelectItem>
                      <SelectItem value="cooperativa">Cooperativa</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Volumen (kg)</Label><Input type="number" value={form.volumenKg} onChange={e => setForm(f => ({ ...f, volumenKg: Number(e.target.value) }))} className="bg-secondary border-border mt-1" /></div>
                <div><Label>Precio (€/kg)</Label><Input type="number" step="0.0001" value={form.precioVentaKg} onChange={e => setForm(f => ({ ...f, precioVentaKg: Number(e.target.value) }))} className="bg-secondary border-border mt-1" /></div>
              </div>
              <div><Label>Observaciones</Label><Input value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} className="bg-secondary border-border mt-1" /></div>
              <Button onClick={() => crearMutation.mutate(form)} disabled={crearMutation.isPending} className="w-full bg-primary text-primary-foreground">
                {crearMutation.isPending ? "Guardando..." : "Registrar Venta"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Total vendido</div>
          <div className="text-xl font-bold">{totalKg.toLocaleString("es-ES")} kg</div>
        </div>
        <div className="bg-card border border-primary/30 rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Ingresos totales</div>
          <div className="text-xl font-bold text-primary">{totalEur.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Precio medio obtenido</div>
          <div className="text-xl font-bold">
            {totalKg > 0 ? (totalEur / totalKg).toFixed(4) : "—"} €/kg
          </div>
          {precioMercado && totalKg > 0 && (
            <div className={`text-xs mt-1 ${(totalEur / totalKg) >= precioMercado ? "text-green-400" : "text-red-400"}`}>
              {(totalEur / totalKg) >= precioMercado ? "Por encima" : "Por debajo"} del mercado
            </div>
          )}
        </div>
      </div>

      {/* Tabla de ventas */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Historial de Ventas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : ventas?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay ventas registradas</p>
              <p className="text-sm mt-1">Registra tu primera operación para comenzar el análisis</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left py-2 pr-4">Fecha</th>
                    <th className="text-left py-2 pr-4">Categoría</th>
                    <th className="text-right py-2 pr-4">Volumen</th>
                    <th className="text-right py-2 pr-4">Precio</th>
                    <th className="text-right py-2 pr-4">Total</th>
                    <th className="text-left py-2 pr-4">Canal</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {ventas?.map((v) => {
                    const total = Number(v.volumenKg) * Number(v.precioVentaKg);
                    const vsMarket = precioMercado ? Number(v.precioVentaKg) - precioMercado : null;
                    return (
                      <tr key={v.id} className="border-b border-border/50 hover:bg-secondary/20">
                        <td className="py-2 pr-4">{new Date(v.fechaVenta).toLocaleDateString("es-ES")}</td>
                        <td className="py-2 pr-4"><span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs">{v.categoria}</span></td>
                        <td className="py-2 pr-4 text-right">{Number(v.volumenKg).toLocaleString("es-ES")} kg</td>
                        <td className="py-2 pr-4 text-right">
                          <span>{Number(v.precioVentaKg).toFixed(4)} €/kg</span>
                          {vsMarket !== null && (
                            <span className={`ml-1 text-xs ${vsMarket >= 0 ? "text-green-400" : "text-red-400"}`}>
                              ({vsMarket >= 0 ? "+" : ""}{vsMarket.toFixed(4)})
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right font-medium">{total.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</td>
                        <td className="py-2 pr-4 text-muted-foreground capitalize">{v.canalVenta ?? "—"}</td>
                        <td className="py-2">
                          <Button variant="ghost" size="sm" onClick={() => eliminarMutation.mutate({ id: v.id })} className="text-muted-foreground hover:text-destructive h-7 w-7 p-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
