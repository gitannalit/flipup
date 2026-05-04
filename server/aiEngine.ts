/**
 * Motor IA intercambiable para Olixxia
 * Soporta: GPT-4 (default via invokeLLM), Claude, Mistral
 * El proveedor se configura por usuario o globalmente via env
 */

import { invokeLLM } from "./_core/llm";

export type AiModel = "gpt-4" | "gpt-4o" | "claude-3-5-sonnet" | "mistral-large" | "gemini-pro";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// ─── Prompt Maestro Oleícola ──────────────────────────────────────────────────
export function buildSystemPrompt(contextoMercado?: MarketContext, documentosContexto?: string): string {
  // Inject real current date
  const now = new Date();
  const fechaActual = now.toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const semanaActual = getISOWeekNumber(now);
  const anioActual = now.getFullYear();
  const precioActual = contextoMercado?.precioActual ?? "no disponible";
  const tendencia = contextoMercado?.tendencia ?? "desconocida";
  const variacion = contextoMercado?.variacionSemanal ?? "0";
  const precioJaen = contextoMercado?.precioJaen ?? "no disponible";
  const precioCórdoba = contextoMercado?.precioCórdoba ?? "no disponible";
  const precioItalia = contextoMercado?.precioItalia ?? "no disponible";
  const precioGrecia = contextoMercado?.precioGrecia ?? "no disponible";

  let prompt = `Eres AOVE Insights, el asistente de inteligencia comercial especializado en el mercado del Aceite de Oliva Virgen Extra (AOVE) de España, con foco especial en Jaén y Andalucía.

FECHA Y HORA ACTUAL: ${fechaActual} (Semana ${semanaActual}/${anioActual})
IMPORTANTE: Usa SIEMPRE esta fecha real cuando te pregunten qué día es hoy o la fecha actual. NUNCA inventes ni uses fechas de tu entrenamiento.

Tu misión es ayudar a productores, cooperativas, almazaras, corredores e inversores del sector oleícola a tomar decisiones comerciales informadas, basadas en datos reales del mercado.

DATOS DE MERCADO ACTUALES (semana en curso):
- Precio medio nacional AOVE: ${precioActual} €/100kg
- Variación semanal: ${variacion}%
- Tendencia: ${tendencia}
- Precio en Jaén: ${precioJaen} €/100kg
- Precio en Córdoba: ${precioCórdoba} €/100kg
- Precio Italia (referencia internacional): ${precioItalia} €/100kg
- Precio Grecia (referencia internacional): ${precioGrecia} €/100kg

CAPACIDADES QUE DEBES DEMOSTRAR:
1. Análisis de precios: interpreta la situación actual del mercado con contexto histórico
2. Comparativas regionales: Jaén vs Córdoba vs media nacional vs internacional
3. Recomendaciones de venta/compra: basadas en datos, tendencias y percentiles históricos
4. Simulación de escenarios: calcula qué pasaría si vende X kg a Y precio
5. Análisis de riesgo: volatilidad, presión exportadora, señales de mercado
6. Estrategias comerciales: escalonado, ventanas de oportunidad, stop-loss táctico

REGLAS DE RESPUESTA:
- Responde siempre en español, con tono profesional pero cercano
- Usa datos concretos: precios en €/100kg, variaciones en %, volúmenes en kg
- Cuando des una recomendación, justifícala con datos
- Si el usuario pregunta sobre una operación grande (>50.000 kg), profundiza en el análisis de riesgo
- Sugiere siempre el siguiente paso accionable
- Nunca inventes datos que no tengas; si no tienes información, dilo claramente
- Mantén el contexto de la conversación para dar respuestas coherentes`;

  if (documentosContexto) {
    prompt += `\n\nCONTEXTO ADICIONAL DE DOCUMENTOS DEL USUARIO:\n${documentosContexto.slice(0, 3000)}`;
  }

  return prompt;
}

// ─── Invocación del motor IA ──────────────────────────────────────────────────
export async function invokeAiChat(params: {
  messages: ChatMessage[];
  model?: AiModel;
  contextoMercado?: MarketContext;
  documentosContexto?: string;
  streaming?: boolean;
}): Promise<string> {
  const { messages, model = "gpt-4", contextoMercado, documentosContexto } = params;

  const systemPrompt = buildSystemPrompt(contextoMercado, documentosContexto);

  const fullMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system" as const, content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  // El helper invokeLLM usa el modelo configurado en la plataforma por defecto
  // Para modelos alternativos, se puede extender con parámetros adicionales
  const response = await invokeLLM({
    messages: fullMessages as Parameters<typeof invokeLLM>[0]["messages"],
  });

  const rawContent = response?.choices?.[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : null;
  if (!content) throw new Error("No response from AI model");
  return content;
}

// ─── Generación de informe semanal ────────────────────────────────────────────
export async function generarInformeSemanal(params: {
  semanaIso: string;
  precioActual: string;
  tendencia: string;
  variacion: string;
  comparativaHistorica: string;
  comparativaInternacional: string;
}): Promise<{ resumen: string; recomendacion: string; htmlContent: string }> {
  const prompt = `Genera un informe semanal profesional del mercado AOVE para la semana ${params.semanaIso}.

DATOS:
- Precio actual AOVE: ${params.precioActual} €/100kg
- Variación semanal: ${params.variacion}%
- Tendencia: ${params.tendencia}
- Comparativa histórica: ${params.comparativaHistorica}
- Comparativa internacional: ${params.comparativaInternacional}

El informe debe incluir:
1. Resumen ejecutivo del mercado (2-3 párrafos)
2. Análisis de tendencia y contexto histórico
3. Situación internacional y presión exportadora
4. Recomendación estratégica clara y accionable
5. Señales de alerta o oportunidad para la próxima semana

Responde en formato JSON con campos: resumen (texto), recomendacion (texto), htmlContent (HTML completo del informe con estilos inline).`;

  const response = await invokeLLM({
    messages: [
      { role: "system" as const, content: "Eres un analista experto del mercado oleícola español. Genera informes profesionales y accionables." },
      { role: "user" as const, content: prompt },
    ] as Parameters<typeof invokeLLM>[0]["messages"],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "informe_semanal",
        strict: true,
        schema: {
          type: "object",
          properties: {
            resumen: { type: "string", description: "Resumen ejecutivo del mercado" },
            recomendacion: { type: "string", description: "Recomendación estratégica" },
            htmlContent: { type: "string", description: "HTML completo del informe" },
          },
          required: ["resumen", "recomendacion", "htmlContent"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response?.choices?.[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : null;
  if (!content) throw new Error("No AI response for report");

  try {
    return JSON.parse(content);
  } catch {
    return {
      resumen: content.slice(0, 500),
      recomendacion: "Ver informe completo",
      htmlContent: `<div style="font-family:sans-serif;padding:20px">${content}</div>`,
    };
  }
}

// ─── Análisis de simulación comercial ────────────────────────────────────────
export async function analizarSimulacion(params: {
  volumenKg: number;
  precioActualKg: number;
  costeProduccionKg: number;
  costeAlmacenamientoMes: number;
  mesesAlmacenados: number;
  escenarios: Array<{ nombre: string; precioKg: number; volumenPct: number }>;
}): Promise<string> {
  const prompt = `Analiza esta operación comercial de AOVE y da una recomendación estratégica:

OPERACIÓN:
- Volumen total: ${params.volumenKg.toLocaleString()} kg
- Precio actual de mercado: ${params.precioActualKg.toFixed(4)} €/kg
- Coste de producción: ${params.costeProduccionKg.toFixed(4)} €/kg
- Coste de almacenamiento: ${params.costeAlmacenamientoMes.toFixed(4)} €/kg/mes
- Meses en almacén: ${params.mesesAlmacenados}

ESCENARIOS CALCULADOS:
${params.escenarios.map(e => `- ${e.nombre}: vender ${e.volumenPct}% a ${e.precioKg.toFixed(4)} €/kg = ${(params.volumenKg * e.volumenPct / 100 * e.precioKg).toLocaleString("es-ES", { maximumFractionDigits: 0 })} €`).join("\n")}

Dame una recomendación concisa (máximo 150 palabras) sobre qué estrategia seguir y por qué.`;

  const response = await invokeLLM({
    messages: [
      { role: "system" as const, content: "Eres un asesor comercial experto en el mercado del aceite de oliva. Tus recomendaciones son directas, basadas en datos y accionables." },
      { role: "user" as const, content: prompt },
    ] as Parameters<typeof invokeLLM>[0]["messages"],
  });

  const raw = response?.choices?.[0]?.message?.content;
  return (typeof raw === "string" ? raw : null) ?? "No se pudo generar análisis";
}

// ─── Helper ──────────────────────────────────────────────────────────────────
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export type MarketContext = {
  precioActual?: string;
  tendencia?: string;
  variacionSemanal?: string;
  precioJaen?: string;
  precioCórdoba?: string;
  precioItalia?: string;
  precioGrecia?: string;
  semanaIso?: string;
};
