/**
 * Servicio de informes semanales AOVE
 * Genera informes en HTML/PDF y los envía por email
 */

import { createInforme, getInformes, getPrecioMapaActual, getPreciosComparativaInternacional, getUltimosPreciosMapa } from "./db";
import { generarInformeSemanal } from "./aiEngine";
import { notifyOwner } from "./_core/notification";

export async function generarYGuardarInformeSemanal(): Promise<{
  semanaIso: string;
  resumen: string;
  recomendacion: string;
  htmlContent: string;
}> {
  // Obtener datos de mercado
  const precioActual = await getPrecioMapaActual("AOVE");
  const historico = await getUltimosPreciosMapa("AOVE", 8);
  const internacional = await getPreciosComparativaInternacional();

  if (!precioActual) {
    throw new Error("No hay datos de mercado disponibles para generar el informe");
  }

  const precioAnterior = historico[1];
  const variacion = precioAnterior
    ? (((Number(precioActual.precioNacional100kg) - Number(precioAnterior.precioNacional100kg)) / Number(precioAnterior.precioNacional100kg)) * 100).toFixed(2)
    : "0";

  // Datos históricos para comparativa
  const comparativaHistorica = historico
    .slice(0, 5)
    .map(p => `${p.semanaIso}: ${Number(p.precioNacional100kg).toFixed(2)} €/100kg`)
    .join(", ");

  // Datos internacionales
  const intlPorPais: Record<string, number> = {};
  for (const p of internacional.slice(0, 8)) {
    if (!intlPorPais[p.pais]) intlPorPais[p.pais] = Number(p.precio100kg);
  }
  const comparativaInternacional = Object.entries(intlPorPais)
    .map(([pais, precio]) => `${pais}: ${precio.toFixed(2)} €/100kg`)
    .join(", ");

  const tendencia = Number(variacion) > 0 ? "alcista" : Number(variacion) < 0 ? "bajista" : "estable";

  // Generar informe con IA
  const informe = await generarInformeSemanal({
    semanaIso: precioActual.semanaIso,
    precioActual: String(precioActual.precioNacional100kg),
    tendencia,
    variacion,
    comparativaHistorica,
    comparativaInternacional,
  });

  // Guardar en base de datos
  await createInforme({
    semanaIso: precioActual.semanaIso,
    titulo: `Informe Semanal AOVE — ${precioActual.semanaIso}`,
    resumenIa: informe.resumen,
    recomendacion: informe.recomendacion,
    htmlContent: informe.htmlContent,
    precioReferencia: String(precioActual.precioNacional100kg),
    tendencia,
    enviado: false,
  });

  return {
    semanaIso: precioActual.semanaIso,
    ...informe,
  };
}

export async function generarHTMLInforme(params: {
  semanaIso: string;
  precioActual: string;
  precioJaen: string;
  precioCórdoba: string;
  variacion: string;
  tendencia: string;
  precioItalia?: string;
  precioGrecia?: string;
  resumenIa?: string;
  recomendacion?: string;
}): Promise<string> {
  const tendenciaColor = params.tendencia === "alcista" ? "#4ade80" : params.tendencia === "bajista" ? "#f87171" : "#facc15";
  const variacionSign = Number(params.variacion) >= 0 ? "+" : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Informe Semanal AOVE — ${params.semanaIso}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #1a1a0f; color: #f0ede0; }
    .container { max-width: 700px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 2px solid #c9a84c; }
    .logo { font-size: 28px; font-weight: 700; color: #c9a84c; letter-spacing: 2px; }
    .subtitle { color: #9a9070; font-size: 14px; margin-top: 8px; }
    .week-badge { display: inline-block; background: rgba(201,168,76,0.15); border: 1px solid rgba(201,168,76,0.4); color: #c9a84c; padding: 4px 16px; border-radius: 20px; font-size: 12px; margin-top: 12px; }
    .metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 32px; }
    .metric-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; }
    .metric-label { font-size: 11px; color: #9a9070; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .metric-value { font-size: 28px; font-weight: 700; color: #c9a84c; }
    .metric-sub { font-size: 12px; color: #9a9070; margin-top: 4px; }
    .metric-change { font-size: 13px; font-weight: 600; margin-top: 6px; color: ${tendenciaColor}; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 16px; font-weight: 600; color: #c9a84c; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid rgba(201,168,76,0.2); }
    .intl-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .intl-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 14px; }
    .intl-country { font-size: 12px; color: #9a9070; margin-bottom: 4px; }
    .intl-price { font-size: 18px; font-weight: 600; }
    .analysis-box { background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.25); border-radius: 12px; padding: 20px; }
    .recommendation-box { background: rgba(74,222,128,0.08); border: 1px solid rgba(74,222,128,0.25); border-radius: 12px; padding: 20px; margin-top: 16px; }
    .rec-title { font-size: 13px; font-weight: 600; color: #4ade80; margin-bottom: 10px; }
    p { line-height: 1.7; color: #d0cdb8; font-size: 14px; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); color: #6b6850; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🫒 OLIXXIA</div>
      <div class="subtitle">Inteligencia Comercial AOVE</div>
      <div class="week-badge">${params.semanaIso}</div>
    </div>

    <div class="metrics-grid">
      <div class="metric-card" style="border-color: rgba(201,168,76,0.4); grid-column: span 2;">
        <div class="metric-label">Precio Nacional AOVE</div>
        <div class="metric-value">${Number(params.precioActual).toFixed(2)} €</div>
        <div class="metric-sub">por 100 kg · Media nacional</div>
        <div class="metric-change">${variacionSign}${params.variacion}% vs semana anterior · Tendencia ${params.tendencia}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Jaén</div>
        <div class="metric-value" style="font-size: 22px;">${Number(params.precioJaen).toFixed(2)} €</div>
        <div class="metric-sub">por 100 kg</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Córdoba</div>
        <div class="metric-value" style="font-size: 22px;">${Number(params.precioCórdoba).toFixed(2)} €</div>
        <div class="metric-sub">por 100 kg</div>
      </div>
    </div>

    ${params.precioItalia || params.precioGrecia ? `
    <div class="section">
      <div class="section-title">Comparativa Internacional</div>
      <div class="intl-grid">
        <div class="intl-card">
          <div class="intl-country">🇪🇸 España</div>
          <div class="intl-price" style="color: #c9a84c;">${Number(params.precioActual).toFixed(2)} €/100kg</div>
        </div>
        ${params.precioItalia ? `<div class="intl-card"><div class="intl-country">🇮🇹 Italia</div><div class="intl-price">${Number(params.precioItalia).toFixed(2)} €/100kg</div></div>` : ""}
        ${params.precioGrecia ? `<div class="intl-card"><div class="intl-country">🇬🇷 Grecia</div><div class="intl-price">${Number(params.precioGrecia).toFixed(2)} €/100kg</div></div>` : ""}
      </div>
    </div>
    ` : ""}

    ${params.resumenIa ? `
    <div class="section">
      <div class="section-title">Análisis del Mercado</div>
      <div class="analysis-box">
        <p>${params.resumenIa}</p>
      </div>
    </div>
    ` : ""}

    ${params.recomendacion ? `
    <div class="recommendation-box">
      <div class="rec-title">✅ Recomendación Estratégica</div>
      <p>${params.recomendacion}</p>
    </div>
    ` : ""}

    <div class="footer">
      <p>Informe generado por Olixxia · Datos: MAPA + EU Agridata</p>
      <p style="margin-top: 4px;">© 2025 Olixxia — Inteligencia Comercial AOVE · Jaén, España</p>
    </div>
  </div>
</body>
</html>`;
}
