/**
 * Script para cargar datos reales del MAPA en la base de datos
 * Ejecutar: node seed-real-data.mjs
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

// Datos reales extraídos del boletín MAPA semana 17/2026 (20-26 abril 2026)
const preciosMapa = [
  // Semana 17/2026 — datos oficiales MAPA
  { semanaIso: "2026-W17", fechaInicio: "2026-04-20", categoria: "AOVE", precioNacional: 429.11, precioAndalucia: 427.00, precioJaen: 426.50, precioCórdoba: 429.00, tendencia: 1.44 },
  { semanaIso: "2026-W17", fechaInicio: "2026-04-20", categoria: "AOV", precioNacional: 371.44, precioAndalucia: 369.00, precioJaen: 357.50, precioCórdoba: 347.50, tendencia: 3.50 },
  { semanaIso: "2026-W17", fechaInicio: "2026-04-20", categoria: "AOL", precioNacional: 335.58, precioAndalucia: 333.00, precioJaen: 336.50, precioCórdoba: 317.50, tendencia: 2.29 },
  // Semana 16/2026
  { semanaIso: "2026-W16", fechaInicio: "2026-04-13", categoria: "AOVE", precioNacional: 423.01, precioAndalucia: 421.00, precioJaen: 418.00, precioCórdoba: 429.00, tendencia: -0.50 },
  { semanaIso: "2026-W16", fechaInicio: "2026-04-13", categoria: "AOV", precioNacional: 358.89, precioAndalucia: 356.00, precioJaen: 357.50, precioCórdoba: 331.50, tendencia: -0.80 },
  // Semana 15/2026
  { semanaIso: "2026-W15", fechaInicio: "2026-04-06", categoria: "AOVE", precioNacional: 425.00, precioAndalucia: 423.00, precioJaen: 425.00, precioCórdoba: 428.00, tendencia: 0.20 },
  // Semana 14/2026
  { semanaIso: "2026-W14", fechaInicio: "2026-03-30", categoria: "AOVE", precioNacional: 424.20, precioAndalucia: 422.00, precioJaen: 436.00, precioCórdoba: 433.00, tendencia: -0.10 },
  // Semana 13/2026
  { semanaIso: "2026-W13", fechaInicio: "2026-03-23", categoria: "AOVE", precioNacional: 427.16, precioAndalucia: 425.00, precioJaen: 426.50, precioCórdoba: 426.50, tendencia: -0.30 },
  // Histórico 2025 semana 17
  { semanaIso: "2025-W17", fechaInicio: "2025-04-21", categoria: "AOVE", precioNacional: 390.28, precioAndalucia: 388.00, precioJaen: 385.00, precioCórdoba: 392.00, tendencia: -2.50 },
  // Histórico 2024 semana 17 — pico máximo
  { semanaIso: "2024-W17", fechaInicio: "2024-04-22", categoria: "AOVE", precioNacional: 762.79, precioAndalucia: 758.00, precioJaen: 758.20, precioCórdoba: 770.60, tendencia: 1.20 },
  // Histórico 2023
  { semanaIso: "2023-W17", fechaInicio: "2023-04-24", categoria: "AOVE", precioNacional: 545.93, precioAndalucia: 542.00, precioJaen: 538.00, precioCórdoba: 548.00, tendencia: 2.10 },
  // Histórico 2022
  { semanaIso: "2022-W17", fechaInicio: "2022-04-25", categoria: "AOVE", precioNacional: 339.27, precioAndalucia: 337.00, precioJaen: 335.00, precioCórdoba: 341.00, tendencia: 0.80 },
];

const preciosIntl = [
  // Semana 17/2026 — datos oficiales MAPA (fuente DG AGRI, ISMEA)
  { semana: "2026-W17", fecha: "2026-04-20", pais: "Spain", codigo: "ES", precio: 429.11 },
  { semana: "2026-W17", fecha: "2026-04-20", pais: "Italy", codigo: "IT", precio: 663.00 },
  { semana: "2026-W17", fecha: "2026-04-20", pais: "Greece", codigo: "GR", precio: 434.16 },
  { semana: "2026-W17", fecha: "2026-04-20", pais: "Portugal", codigo: "PT", precio: 425.00 },
  { semana: "2026-W17", fecha: "2026-04-20", pais: "Tunisia", codigo: "TN", precio: 415.00 },
  // Semana 16
  { semana: "2026-W16", fecha: "2026-04-13", pais: "Spain", codigo: "ES", precio: 423.01 },
  { semana: "2026-W16", fecha: "2026-04-13", pais: "Italy", codigo: "IT", precio: 667.00 },
  { semana: "2026-W16", fecha: "2026-04-13", pais: "Greece", codigo: "GR", precio: 430.00 },
  { semana: "2026-W16", fecha: "2026-04-13", pais: "Tunisia", codigo: "TN", precio: 390.00 },
  // Semana 15
  { semana: "2026-W15", fecha: "2026-04-06", pais: "Spain", codigo: "ES", precio: 425.00 },
  { semana: "2026-W15", fecha: "2026-04-06", pais: "Italy", codigo: "IT", precio: 669.00 },
  { semana: "2026-W15", fecha: "2026-04-06", pais: "Greece", codigo: "GR", precio: 434.00 },
  { semana: "2026-W15", fecha: "2026-04-06", pais: "Tunisia", codigo: "TN", precio: 395.00 },
  // Semana 14
  { semana: "2026-W14", fecha: "2026-03-30", pais: "Spain", codigo: "ES", precio: 424.20 },
  { semana: "2026-W14", fecha: "2026-03-30", pais: "Italy", codigo: "IT", precio: 673.00 },
  { semana: "2026-W14", fecha: "2026-03-30", pais: "Greece", codigo: "GR", precio: 434.00 },
  { semana: "2026-W14", fecha: "2026-03-30", pais: "Tunisia", codigo: "TN", precio: 399.00 },
  // Semana 13
  { semana: "2026-W13", fecha: "2026-03-23", pais: "Spain", codigo: "ES", precio: 427.16 },
  { semana: "2026-W13", fecha: "2026-03-23", pais: "Italy", codigo: "IT", precio: 673.00 },
  { semana: "2026-W13", fecha: "2026-03-23", pais: "Greece", codigo: "GR", precio: 440.00 },
  { semana: "2026-W13", fecha: "2026-03-23", pais: "Tunisia", codigo: "TN", precio: 400.00 },
  // Histórico 2025 semana 17
  { semana: "2025-W17", fecha: "2025-04-21", pais: "Spain", codigo: "ES", precio: 390.28 },
  { semana: "2025-W17", fecha: "2025-04-21", pais: "Italy", codigo: "IT", precio: 815.00 },
  { semana: "2025-W17", fecha: "2025-04-21", pais: "Greece", codigo: "GR", precio: 768.00 },
  { semana: "2025-W17", fecha: "2025-04-21", pais: "Tunisia", codigo: "TN", precio: 401.00 },
  // Histórico 2024 semana 17 — pico
  { semana: "2024-W17", fecha: "2024-04-22", pais: "Spain", codigo: "ES", precio: 762.79 },
  { semana: "2024-W17", fecha: "2024-04-22", pais: "Italy", codigo: "IT", precio: 939.00 },
  { semana: "2024-W17", fecha: "2024-04-22", pais: "Greece", codigo: "GR", precio: 958.00 },
  { semana: "2024-W17", fecha: "2024-04-22", pais: "Tunisia", codigo: "TN", precio: 763.00 },
  // Histórico 2023
  { semana: "2023-W17", fecha: "2023-04-24", pais: "Spain", codigo: "ES", precio: 545.93 },
  { semana: "2023-W17", fecha: "2023-04-24", pais: "Italy", codigo: "IT", precio: 522.29 },
  { semana: "2023-W17", fecha: "2023-04-24", pais: "Greece", codigo: "GR", precio: 503.90 },
  // Histórico 2022
  { semana: "2022-W17", fecha: "2022-04-25", pais: "Spain", codigo: "ES", precio: 339.27 },
  { semana: "2022-W17", fecha: "2022-04-25", pais: "Italy", codigo: "IT", precio: 326.62 },
  { semana: "2022-W17", fecha: "2022-04-25", pais: "Greece", codigo: "GR", precio: 318.12 },
];

console.log("🌿 Cargando datos reales MAPA en base de datos...");

// Insert precios_mapa
let countMapa = 0;
for (const p of preciosMapa) {
  await connection.execute(
    `INSERT INTO precios_mapa (semanaIso, fechaInicio, categoria, precioNacional100kg, precioAndalucia100kg, precioJaen100kg, \`precioCórdoba100kg\`, tendenciaPct, fuente, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE precioNacional100kg=VALUES(precioNacional100kg), precioJaen100kg=VALUES(precioJaen100kg), \`precioCórdoba100kg\`=VALUES(\`precioCórdoba100kg\`), tendenciaPct=VALUES(tendenciaPct)`,
    [p.semanaIso, p.fechaInicio, p.categoria, p.precioNacional, p.precioAndalucia, p.precioJaen, p.precioCórdoba, p.tendencia, "MAPA_OFICIAL_2026"]
  );
  countMapa++;
}
console.log(`✅ ${countMapa} registros de precios MAPA cargados`);

// Insert precios_internacionales
let countIntl = 0;
for (const p of preciosIntl) {
  const fechaFin = new Date(new Date(p.fecha).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const anio = p.semana.startsWith("2026") ? "2025/2026" : p.semana.startsWith("2025") ? "2024/2025" : p.semana.startsWith("2024") ? "2023/2024" : "2022/2023";
  await connection.execute(
    `INSERT INTO precios_internacionales (semanaIso, fechaInicio, fechaFin, pais, codigoPais, producto, precio100kg, moneda, anioMarketing, fuente, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'EUR', ?, ?, NOW())
     ON DUPLICATE KEY UPDATE precio100kg=VALUES(precio100kg)`,
    [p.semana, p.fecha, fechaFin, p.pais, p.codigo, "Extra virgin olive oil (up to 0.8%)", p.precio, anio, "MAPA_OFICIAL_2026"]
  );
  countIntl++;
}
console.log(`✅ ${countIntl} registros de precios internacionales cargados`);

// Verify
const [rows] = await connection.execute("SELECT semanaIso, categoria, precioNacional100kg FROM precios_mapa ORDER BY fechaInicio DESC LIMIT 5");
console.log("\n📊 Últimos datos en BD:");
for (const row of rows) {
  console.log(`  ${row.semanaIso} | ${row.categoria} | ${row.precioNacional100kg} €/100kg`);
}

await connection.end();
console.log("\n✅ Seed completado exitosamente");
