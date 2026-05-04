import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, Plus, Trash2, BellOff } from "lucide-react";

export default function Alertas() {
  const utils = trpc.useUtils();
  const { data: alertas, isLoading } = trpc.alertas.listar.useQuery();
  const { data: resumen } = trpc.precios.resumenMercado.useQuery();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    categoria: "AOVE" as "AOVE" | "AOV" | "AOL" | "AOR",
    tipoAlerta: "precio_supera" as "precio_supera" | "precio_baja" | "variacion_pct",
    umbralKg: 9.0,
    notificarEmail: true,
  });

  const crearMutation = trpc.alertas.crear.useMutation({
    onSuccess: () => { toast.success("Alerta creada"); utils.alertas.listar.invalidate(); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const eliminarMutation = trpc.alertas.eliminar.useMutation({
    onSuccess: () => { toast.success("Alerta eliminada"); utils.alertas.listar.invalidate(); },
  });
  const actualizarMutation = trpc.alertas.actualizar.useMutation({
    onSuccess: () => utils.alertas.listar.invalidate(),
  });

  const precioActual = resumen?.precioActual ? Number(resumen.precioActual) / 100 : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            Alertas de Precio
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Recibe notificaciones cuando el mercado alcance tus umbrales
            {precioActual && <span> · Precio actual: <strong className="text-foreground">{precioActual.toFixed(4)} €/kg</strong></span>}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground"><Plus className="w-4 h-4 mr-2" />Nueva Alerta</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Crear Alerta de Precio</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nombre de la alerta</Label><Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Alerta venta AOVE" className="bg-secondary border-border mt-1" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Categoría</Label>
                  <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v as typeof form.categoria }))}>
                    <SelectTrigger className="bg-secondary border-border mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="AOVE">AOVE</SelectItem><SelectItem value="AOV">AOV</SelectItem><SelectItem value="AOL">AOL</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de alerta</Label>
                  <Select value={form.tipoAlerta} onValueChange={v => setForm(f => ({ ...f, tipoAlerta: v as typeof form.tipoAlerta }))}>
                    <SelectTrigger className="bg-secondary border-border mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="precio_supera">Precio supera umbral</SelectItem>
                      <SelectItem value="precio_baja">Precio baja de umbral</SelectItem>
                      <SelectItem value="variacion_pct">Variación % semanal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Umbral (€/kg)</Label>
                <Input type="number" step="0.01" value={form.umbralKg} onChange={e => setForm(f => ({ ...f, umbralKg: Number(e.target.value) }))} className="bg-secondary border-border mt-1" />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.notificarEmail} onCheckedChange={v => setForm(f => ({ ...f, notificarEmail: v }))} />
                <Label>Notificar por email</Label>
              </div>
              <Button onClick={() => crearMutation.mutate({ ...form, umbralKg: form.umbralKg })} disabled={!form.nombre || crearMutation.isPending} className="w-full bg-primary text-primary-foreground">
                Crear Alerta
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>
      ) : alertas?.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BellOff className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No tienes alertas configuradas</p>
            <p className="text-sm text-muted-foreground mt-1">Crea una alerta para recibir notificaciones cuando el precio alcance tu objetivo</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alertas?.map((alerta) => {
            const triggered = precioActual && alerta.umbralKg
              ? (alerta.tipoAlerta === "precio_supera" && precioActual >= Number(alerta.umbralKg))
              || (alerta.tipoAlerta === "precio_baja" && precioActual <= Number(alerta.umbralKg))
              : false;
            return (
              <Card key={alerta.id} className={`bg-card border ${triggered ? "border-yellow-500/40" : "border-border"}`}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${triggered ? "bg-yellow-500/20" : "bg-primary/10"}`}>
                      <Bell className={`w-5 h-5 ${triggered ? "text-yellow-400" : "text-primary"}`} />
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {alerta.nombre}
                        {triggered && <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">¡Activada!</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {alerta.categoria} · {alerta.tipoAlerta === "precio_supera" ? "Supera" : alerta.tipoAlerta === "precio_baja" ? "Baja de" : "Variación"} {Number(alerta.umbralKg).toFixed(4)} €/kg
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={alerta.activa ?? true}
                      onCheckedChange={(v) => actualizarMutation.mutate({ id: alerta.id, activa: v })}
                    />
                    <Button variant="ghost" size="sm" onClick={() => eliminarMutation.mutate({ id: alerta.id })} className="text-muted-foreground hover:text-destructive h-8 w-8 p-0">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
