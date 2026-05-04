import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  alertas,
  conversaciones,
  costesCliente,
  documentos,
  informes,
  InsertAlerta,
  InsertConversacion,
  InsertCosteCliente,
  InsertDocumento,
  InsertInforme,
  InsertNoticia,
  InsertPrecioInternacional,
  InsertPrecioMapa,
  InsertSimulacion,
  InsertUser,
  InsertVentaCliente,
  noticias,
  preciosInternacionales,
  preciosMapa,
  simulaciones,
  users,
  ventasCliente,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserPreferences(userId: number, prefs: { preferredAiModel?: string; organizationName?: string; organizationType?: InsertUser["organizationType"]; province?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(prefs).where(eq(users.id, userId));
}

// ─── Precios MAPA ─────────────────────────────────────────────────────────────
export async function upsertPrecioMapa(precio: InsertPrecioMapa) {
  const db = await getDb();
  if (!db) return;
  await db.insert(preciosMapa).values(precio).onDuplicateKeyUpdate({ set: { ...precio } });
}

export async function getUltimosPreciosMapa(categoria: string = "AOVE", limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(preciosMapa)
    .where(eq(preciosMapa.categoria, categoria as "AOVE" | "AOV" | "AOL" | "AOR"))
    .orderBy(desc(preciosMapa.fechaInicio))
    .limit(limit);
}

export async function getPrecioMapaActual(categoria: string = "AOVE") {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(preciosMapa)
    .where(eq(preciosMapa.categoria, categoria as "AOVE" | "AOV" | "AOL" | "AOR"))
    .orderBy(desc(preciosMapa.fechaInicio))
    .limit(1);
  return result[0] ?? null;
}

// ─── Precios Internacionales ──────────────────────────────────────────────────
export async function upsertPrecioInternacional(precio: InsertPrecioInternacional) {
  const db = await getDb();
  if (!db) return;
  await db.insert(preciosInternacionales).values(precio).onDuplicateKeyUpdate({ set: { ...precio } });
}

export async function getPreciosInternacionalesRecientes(limit: number = 40) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(preciosInternacionales)
    .orderBy(desc(preciosInternacionales.fechaInicio))
    .limit(limit);
}

export async function getPreciosComparativaInternacional() {
  const db = await getDb();
  if (!db) return [];
  // Últimos precios por país
  return db.select().from(preciosInternacionales)
    .orderBy(desc(preciosInternacionales.fechaInicio))
    .limit(80);
}

// ─── Ventas Cliente ───────────────────────────────────────────────────────────
export async function getVentasCliente(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ventasCliente)
    .where(eq(ventasCliente.userId, userId))
    .orderBy(desc(ventasCliente.fechaVenta));
}

export async function createVenta(venta: InsertVentaCliente) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(ventasCliente).values(venta);
  return result;
}

export async function deleteVenta(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(ventasCliente).where(and(eq(ventasCliente.id, id), eq(ventasCliente.userId, userId)));
}

// ─── Costes Cliente ───────────────────────────────────────────────────────────
export async function getCostesCliente(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(costesCliente).where(eq(costesCliente.userId, userId)).limit(1);
  return result[0] ?? null;
}

export async function upsertCostesCliente(costes: InsertCosteCliente) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(costesCliente).values(costes).onDuplicateKeyUpdate({ set: { ...costes } });
}

// ─── Simulaciones ─────────────────────────────────────────────────────────────
export async function getSimulaciones(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(simulaciones)
    .where(eq(simulaciones.userId, userId))
    .orderBy(desc(simulaciones.createdAt))
    .limit(20);
}

export async function createSimulacion(sim: InsertSimulacion) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(simulaciones).values(sim);
  return result;
}

// ─── Alertas ──────────────────────────────────────────────────────────────────
export async function getAlertas(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(alertas).where(eq(alertas.userId, userId));
}

export async function createAlerta(alerta: InsertAlerta) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(alertas).values(alerta);
}

export async function updateAlerta(id: number, userId: number, data: Partial<InsertAlerta>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(alertas).set(data).where(and(eq(alertas.id, id), eq(alertas.userId, userId)));
}

export async function deleteAlerta(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(alertas).where(and(eq(alertas.id, id), eq(alertas.userId, userId)));
}

export async function getAlertasActivas() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(alertas).where(eq(alertas.activa, true));
}

// ─── Conversaciones ───────────────────────────────────────────────────────────
export async function getConversaciones(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: conversaciones.id,
    titulo: conversaciones.titulo,
    modeloIa: conversaciones.modeloIa,
    createdAt: conversaciones.createdAt,
    updatedAt: conversaciones.updatedAt,
  }).from(conversaciones)
    .where(eq(conversaciones.userId, userId))
    .orderBy(desc(conversaciones.updatedAt))
    .limit(20);
}

export async function getConversacion(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(conversaciones)
    .where(and(eq(conversaciones.id, id), eq(conversaciones.userId, userId)))
    .limit(1);
  return result[0] ?? null;
}

export async function createConversacion(conv: InsertConversacion) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(conversaciones).values(conv);
  return result;
}

export async function updateConversacion(id: number, userId: number, data: Partial<InsertConversacion>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(conversaciones).set(data).where(and(eq(conversaciones.id, id), eq(conversaciones.userId, userId)));
}

export async function deleteConversacion(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(conversaciones).where(and(eq(conversaciones.id, id), eq(conversaciones.userId, userId)));
}

// ─── Documentos ───────────────────────────────────────────────────────────────
export async function getDocumentos(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentos).where(eq(documentos.userId, userId)).orderBy(desc(documentos.createdAt));
}

export async function createDocumento(doc: InsertDocumento) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(documentos).values(doc);
  return result;
}

export async function updateDocumentoExtracto(id: number, extractoTexto: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(documentos).set({ extractoTexto, procesado: true }).where(eq(documentos.id, id));
}

export async function deleteDocumento(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(documentos).where(and(eq(documentos.id, id), eq(documentos.userId, userId)));
}

// ─── Noticias ─────────────────────────────────────────────────────────────────
export async function getNoticias(limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(noticias).orderBy(desc(noticias.publicadoEn)).limit(limit);
}

export async function upsertNoticia(noticia: InsertNoticia) {
  const db = await getDb();
  if (!db) return;
  await db.insert(noticias).values(noticia).onDuplicateKeyUpdate({ set: { titulo: noticia.titulo, descripcion: noticia.descripcion } });
}

// ─── Informes ─────────────────────────────────────────────────────────────────
export async function getInformes(limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(informes).orderBy(desc(informes.createdAt)).limit(limit);
}

export async function createInforme(informe: InsertInforme) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(informes).values(informe);
  return result;
}
