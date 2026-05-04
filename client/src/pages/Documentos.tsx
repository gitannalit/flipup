import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Upload, Trash2, CheckCircle, Clock, Loader2 } from "lucide-react";

export default function Documentos() {
  const utils = trpc.useUtils();
  const { data: documentos, isLoading } = trpc.documentos.listar.useQuery();
  const [tipo, setTipo] = useState<"boletin_mapa" | "historico_ventas" | "costes" | "otro">("boletin_mapa");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const subirMutation = trpc.documentos.subir.useMutation({
    onSuccess: () => { toast.success("Documento subido correctamente"); utils.documentos.listar.invalidate(); setUploading(false); },
    onError: (e) => { toast.error("Error al subir: " + e.message); setUploading(false); },
  });
  const eliminarMutation = trpc.documentos.eliminar.useMutation({
    onSuccess: () => { toast.success("Documento eliminado"); utils.documentos.listar.invalidate(); },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("El archivo no puede superar 10 MB"); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      subirMutation.mutate({ nombre: file.name, tipo, contenidoBase64: base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const tipoLabels: Record<string, string> = {
    boletin_mapa: "Boletín MAPA",
    historico_ventas: "Historial de Ventas",
    costes: "Costes",
    otro: "Otro",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          Documentos
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Sube boletines MAPA y documentos propios. El chatbot IA los usará como contexto adicional.
        </p>
      </div>

      {/* Upload area */}
      <Card className="bg-card border-border border-dashed">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Tipo de documento</label>
                <Select value={tipo} onValueChange={v => setTipo(v as typeof tipo)}>
                  <SelectTrigger className="bg-secondary border-border w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boletin_mapa">Boletín MAPA</SelectItem>
                    <SelectItem value="historico_ventas">Historial de Ventas</SelectItem>
                    <SelectItem value="costes">Costes</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Formatos aceptados: PDF, Excel, CSV · Máximo 10 MB
              </p>
            </div>
            <div>
              <input ref={fileRef} type="file" accept=".pdf,.xlsx,.csv,.xls" className="hidden" onChange={handleFileChange} />
              <Button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="bg-primary text-primary-foreground"
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Subiendo...</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" />Subir Documento</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document list */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Documentos Subidos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : documentos?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay documentos subidos</p>
              <p className="text-sm mt-1">Sube boletines del MAPA para enriquecer el contexto del chatbot</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documentos?.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{doc.nombre}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                          {tipoLabels[doc.tipo] ?? doc.tipo}
                        </Badge>
                        {doc.tamanoBytes && (
                          <span className="text-xs text-muted-foreground">
                            {(doc.tamanoBytes / 1024).toFixed(0)} KB
                          </span>
                        )}
                        {doc.procesado ? (
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <CheckCircle className="w-3 h-3" />Procesado
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-yellow-400">
                            <Clock className="w-3 h-3" />Pendiente
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => eliminarMutation.mutate({ id: doc.id })}
                    className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
