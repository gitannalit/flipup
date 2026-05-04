import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send, Bot, User, Leaf, TrendingUp, TrendingDown, ShoppingCart, Globe, HelpCircle, Loader2 } from "lucide-react";
import { Streamdown } from "streamdown";

type Message = { role: "user" | "assistant"; content: string };
type AiModel = "gpt-4" | "gpt-4o" | "claude-3-5-sonnet" | "mistral-large" | "gemini-pro";

const QUICK_OPTIONS = [
  { label: "Vender AOVE", icon: TrendingUp, color: "text-green-400" },
  { label: "Comprar AOVE", icon: ShoppingCart, color: "text-blue-400" },
  { label: "Exportar", icon: Globe, color: "text-purple-400" },
  { label: "Aún no estoy seguro", icon: HelpCircle, color: "text-yellow-400" },
];

const VOLUME_OPTIONS = [
  "Menos de 20.000 kg",
  "20.000 - 100.000 kg",
  "Más de 100.000 kg",
];

const SUGGESTED_QUESTIONS = [
  "¿Cómo está el mercado esta semana?",
  "¿Vendo ahora o espero?",
  "¿Cómo está Jaén vs Córdoba?",
  "¿Cuál es la presión exportadora?",
  "¿Qué pasó en semanas similares históricamente?",
];

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<AiModel>("gpt-4");
  const [conversacionId, setConversacionId] = useState<number | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedVolume, setSelectedVolume] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: resumen } = trpc.precios.resumenMercado.useQuery();
  const sendMutation = trpc.chatbot.mensaje.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.respuesta }]);
      if (data.conversacionId) setConversacionId(data.conversacionId);
      setIsTyping(false);
    },
    onError: (err) => {
      toast.error("Error al conectar con el asistente: " + err.message);
      setIsTyping(false);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    setShowOnboarding(false);
    const userMsg: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    sendMutation.mutate({ mensaje: text, modelo: model, conversacionId: conversacionId ?? undefined });
  };

  const handleOptionSelect = (option: string) => {
    setSelectedOption(option);
    if (option === "Aún no estoy seguro") {
      sendMessage("No estoy seguro de lo que quiero hacer. ¿Puedes ayudarme a entender la situación del mercado?");
    }
  };

  const handleVolumeSelect = (volume: string) => {
    setSelectedVolume(volume);
    const msg = `Quiero ${selectedOption?.toLowerCase()} AOVE. El volumen de la operación es: ${volume}. ¿Cuál es tu análisis del mercado actual y tu recomendación?`;
    sendMessage(msg);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-h-[800px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
            <Leaf className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">AOVE Insights</h2>
            <p className="text-xs text-muted-foreground">Asistente inteligente del aceite de oliva</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {resumen?.precioActual && (
            <Badge variant="outline" className="text-xs border-primary/30 text-primary hidden sm:flex">
              {Number(resumen.precioActual).toFixed(2)} €/100kg
              {Number(resumen.variacionSemanal) < 0
                ? <TrendingDown className="w-3 h-3 ml-1 text-red-400" />
                : <TrendingUp className="w-3 h-3 ml-1 text-green-400" />}
            </Badge>
          )}
          <Select value={model} onValueChange={(v) => setModel(v as AiModel)}>
            <SelectTrigger className="w-40 h-8 text-xs bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4">GPT-4</SelectItem>
              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
              <SelectItem value="claude-3-5-sonnet">Claude 3.5</SelectItem>
              <SelectItem value="mistral-large">Mistral Large</SelectItem>
              <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {/* Onboarding flow */}
        {showOnboarding && messages.length === 0 && (
          <div className="space-y-4">
            {/* Welcome */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 max-w-[85%]">
                <p className="text-sm">
                  Hola, soy <strong className="text-primary">AOVE Insights</strong>. Tu asistente especializado en el mercado del aceite de oliva.
                  {resumen?.precioActual && (
                    <span className="text-muted-foreground"> Esta semana el AOVE cotiza a <strong className="text-foreground">{Number(resumen.precioActual).toFixed(2)} €/100kg</strong> con tendencia {resumen.tendencia}.</span>
                  )}
                </p>
              </div>
            </div>

            {/* Option selector */}
            {!selectedOption && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 max-w-[90%]">
                  <p className="text-sm mb-3">Selecciona una opción:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_OPTIONS.map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => handleOptionSelect(opt.label)}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-sm font-medium text-left"
                      >
                        <opt.icon className={`w-4 h-4 ${opt.color}`} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Volume selector */}
            {selectedOption && selectedOption !== "Aún no estoy seguro" && !selectedVolume && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 max-w-[90%]">
                  <p className="text-sm mb-3">¿De cuántos kilos estamos hablando en esta operación?</p>
                  <p className="text-xs text-muted-foreground mb-3">Selecciona una opción:</p>
                  <div className="flex flex-wrap gap-2">
                    {VOLUME_OPTIONS.map((vol) => (
                      <button
                        key={vol}
                        onClick={() => handleVolumeSelect(vol)}
                        className="px-4 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-sm font-medium"
                      >
                        {vol}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chat messages */}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${msg.role === "user" ? "bg-secondary border border-border" : "bg-primary/20 border border-primary/30"}`}>
              {msg.role === "user" ? <User className="w-4 h-4 text-muted-foreground" /> : <Bot className="w-4 h-4 text-primary" />}
            </div>
            <div className={`rounded-2xl px-4 py-3 max-w-[85%] text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"}`}>
              {msg.role === "assistant" ? (
                <Streamdown className="prose prose-sm prose-invert max-w-none">{msg.content}</Streamdown>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested questions */}
      {messages.length > 0 && !isTyping && (
        <div className="flex gap-2 pb-2 overflow-x-auto">
          {SUGGESTED_QUESTIONS.slice(0, 3).map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border pt-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            placeholder={showOnboarding && !selectedOption ? "Responde usando las opciones de arriba" : "Escribe tu pregunta sobre el mercado AOVE..."}
            className="bg-secondary border-border text-sm"
            disabled={isTyping}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isTyping}
            className="bg-primary text-primary-foreground hover:bg-primary/90 px-4"
          >
            {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Motor: {model} · Datos: MAPA + EU Agridata
        </p>
      </div>
    </div>
  );
}
