import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { User, Settings, Bot, Save } from "lucide-react";

export default function Perfil() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    organizationName: "",
    organizationType: "almazara" as "almazara" | "cooperativa" | "corredor" | "exportador" | "inversor" | "otro",
    province: "Jaén",
    preferredAiModel: "gpt-4",
  });

  const actualizarMutation = trpc.perfil.actualizar.useMutation({
    onSuccess: () => toast.success("Perfil actualizado"),
    onError: (e) => toast.error(e.message),
  });

  const { data: costes } = trpc.costes.obtener.useQuery();
  const guardarCostesMutation = trpc.costes.guardar.useMutation({
    onSuccess: () => toast.success("Costes guardados"),
    onError: (e) => toast.error(e.message),
  });
  const [costesForm, setCostesForm] = useState({
    costeProduccionKg: Number(costes?.costeProduccionKg ?? 2.60),
    costeAlmacenamientoMes: Number(costes?.costeAlmacenamientoMes ?? 0.05),
    stockActualKg: Number(costes?.stockActualKg ?? 0),
    precioObjetivoKg: Number(costes?.precioObjetivoKg ?? 0),
  });

  const AI_MODELS = [
    { value: "gpt-4", label: "GPT-4 (OpenAI)" },
    { value: "gpt-4o", label: "GPT-4o (OpenAI)" },
    { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet (Anthropic)" },
    { value: "mistral-large", label: "Mistral Large" },
    { value: "gemini-pro", label: "Gemini Pro (Google)" },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <User className="w-6 h-6 text-primary" />
          Perfil y Configuración
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Personaliza tu experiencia en Olixxia</p>
      </div>

      {/* Info de usuario */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Información de Cuenta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-lg font-bold text-primary">
              {user?.name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div>
              <div className="font-medium">{user?.name ?? "Usuario"}</div>
              <div className="text-sm text-muted-foreground">{user?.email ?? ""}</div>
            </div>
            <Badge variant="outline" className="ml-auto border-primary/30 text-primary text-xs">
              {user?.role === "admin" ? "Administrador" : "Usuario"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Perfil de organización */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            Perfil de Organización
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nombre de la organización</Label>
            <Input value={form.organizationName} onChange={e => setForm(f => ({ ...f, organizationName: e.target.value }))} placeholder="Ej: Cooperativa San Isidro" className="bg-secondary border-border mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo de organización</Label>
              <Select value={form.organizationType} onValueChange={v => setForm(f => ({ ...f, organizationType: v as typeof form.organizationType }))}>
                <SelectTrigger className="bg-secondary border-border mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="almazara">Almazara</SelectItem>
                  <SelectItem value="cooperativa">Cooperativa</SelectItem>
                  <SelectItem value="corredor">Corredor</SelectItem>
                  <SelectItem value="exportador">Exportador</SelectItem>
                  <SelectItem value="inversor">Inversor</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Provincia principal</Label>
              <Input value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} className="bg-secondary border-border mt-1" />
            </div>
          </div>
          <Button onClick={() => actualizarMutation.mutate(form)} disabled={actualizarMutation.isPending} className="bg-primary text-primary-foreground">
            <Save className="w-4 h-4 mr-2" />
            Guardar Perfil
          </Button>
        </CardContent>
      </Card>

      {/* Motor IA */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            Motor de IA Preferido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecciona el modelo de IA que se usará por defecto en el chatbot AOVE Insights.
            Puedes cambiarlo en cualquier momento desde el propio chatbot.
          </p>
          <Select value={form.preferredAiModel} onValueChange={v => setForm(f => ({ ...f, preferredAiModel: v }))}>
            <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AI_MODELS.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => actualizarMutation.mutate({ preferredAiModel: form.preferredAiModel })} disabled={actualizarMutation.isPending} variant="outline" className="border-border">
            Guardar preferencia de IA
          </Button>
        </CardContent>
      </Card>

      {/* Costes de producción */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Costes de Producción</CardTitle>
          <p className="text-xs text-muted-foreground">Estos valores se usan en la calculadora comercial</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Coste producción (€/kg)</Label>
              <Input type="number" step="0.01" value={costesForm.costeProduccionKg} onChange={e => setCostesForm(f => ({ ...f, costeProduccionKg: Number(e.target.value) }))} className="bg-secondary border-border mt-1" />
            </div>
            <div>
              <Label>Almacenamiento (€/kg/mes)</Label>
              <Input type="number" step="0.001" value={costesForm.costeAlmacenamientoMes} onChange={e => setCostesForm(f => ({ ...f, costeAlmacenamientoMes: Number(e.target.value) }))} className="bg-secondary border-border mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Stock actual (kg)</Label>
              <Input type="number" value={costesForm.stockActualKg} onChange={e => setCostesForm(f => ({ ...f, stockActualKg: Number(e.target.value) }))} className="bg-secondary border-border mt-1" />
            </div>
            <div>
              <Label>Precio objetivo (€/kg)</Label>
              <Input type="number" step="0.01" value={costesForm.precioObjetivoKg} onChange={e => setCostesForm(f => ({ ...f, precioObjetivoKg: Number(e.target.value) }))} className="bg-secondary border-border mt-1" />
            </div>
          </div>
          <Button onClick={() => guardarCostesMutation.mutate(costesForm)} disabled={guardarCostesMutation.isPending} className="bg-primary text-primary-foreground">
            <Save className="w-4 h-4 mr-2" />
            Guardar Costes
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
