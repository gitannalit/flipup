import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Preferencias de usuario
  preferredAiModel: varchar("preferredAiModel", { length: 64 }).default("gpt-4"),
  organizationName: text("organizationName"),
  organizationType: mysqlEnum("organizationType", ["almazara", "cooperativa", "corredor", "exportador", "inversor", "otro"]),
  province: varchar("province", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Precios MAPA (datos oficiales semanales) ─────────────────────────────────
export const preciosMapa = mysqlTable("precios_mapa", {
  id: int("id").autoincrement().primaryKey(),
  semanaIso: varchar("semanaIso", { length: 10 }).notNull(), // e.g. "2025-W19"
  fechaInicio: timestamp("fechaInicio").notNull(),
  categoria: mysqlEnum("categoria", ["AOVE", "AOV", "AOL", "AOR"]).notNull(),
  precioNacional100kg: decimal("precioNacional100kg", { precision: 10, scale: 2 }),
  precioAndalucia100kg: decimal("precioAndalucia100kg", { precision: 10, scale: 2 }),
  precioJaen100kg: decimal("precioJaen100kg", { precision: 10, scale: 2 }),
  precioCórdoba100kg: decimal("precioCórdoba100kg", { precision: 10, scale: 2 }),
  precioSevilla100kg: decimal("precioSevilla100kg", { precision: 10, scale: 2 }),
  tendenciaPct: decimal("tendenciaPct", { precision: 6, scale: 3 }),
  fuente: text("fuente"),
  rawData: json("rawData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PrecioMapa = typeof preciosMapa.$inferSelect;
export type InsertPrecioMapa = typeof preciosMapa.$inferInsert;

// ─── Precios Internacionales (EU Agridata) ────────────────────────────────────
export const preciosInternacionales = mysqlTable("precios_internacionales", {
  id: int("id").autoincrement().primaryKey(),
  semanaIso: varchar("semanaIso", { length: 10 }).notNull(),
  fechaInicio: timestamp("fechaInicio").notNull(),
  fechaFin: timestamp("fechaFin").notNull(),
  pais: varchar("pais", { length: 64 }).notNull(), // "Spain", "Italy", "Greece", "Tunisia"
  codigoPais: varchar("codigoPais", { length: 4 }).notNull(), // "ES", "IT", "GR", "TN"
  producto: varchar("producto", { length: 128 }).notNull(),
  mercado: varchar("mercado", { length: 128 }),
  precio100kg: decimal("precio100kg", { precision: 10, scale: 2 }),
  moneda: varchar("moneda", { length: 8 }).default("EUR"),
  anioMarketing: varchar("anioMarketing", { length: 10 }),
  fuente: varchar("fuente", { length: 32 }).default("EU_AGRIDATA"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PrecioInternacional = typeof preciosInternacionales.$inferSelect;
export type InsertPrecioInternacional = typeof preciosInternacionales.$inferInsert;

// ─── Ventas del Cliente ───────────────────────────────────────────────────────
export const ventasCliente = mysqlTable("ventas_cliente", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fechaVenta: timestamp("fechaVenta").notNull(),
  semanaIso: varchar("semanaIso", { length: 10 }),
  provincia: varchar("provincia", { length: 64 }),
  categoria: mysqlEnum("categoria", ["AOVE", "AOV", "AOL", "AOR"]).notNull(),
  volumenKg: decimal("volumenKg", { precision: 12, scale: 2 }).notNull(),
  precioVentaKg: decimal("precioVentaKg", { precision: 10, scale: 4 }).notNull(),
  canalVenta: mysqlEnum("canalVenta", ["granel", "exportacion", "embotellado", "cooperativa", "otro"]),
  observaciones: text("observaciones"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VentaCliente = typeof ventasCliente.$inferSelect;
export type InsertVentaCliente = typeof ventasCliente.$inferInsert;

// ─── Costes del Cliente ───────────────────────────────────────────────────────
export const costesCliente = mysqlTable("costes_cliente", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  costeProduccionKg: decimal("costeProduccionKg", { precision: 10, scale: 4 }).default("2.60"),
  costeAlmacenamientoMes: decimal("costeAlmacenamientoMes", { precision: 10, scale: 4 }).default("0.05"),
  capacidadAlmacenKg: decimal("capacidadAlmacenKg", { precision: 12, scale: 2 }),
  fechaCosechaInicio: timestamp("fechaCosechaInicio"),
  fechaFinAlmazara: timestamp("fechaFinAlmazara"),
  stockActualKg: decimal("stockActualKg", { precision: 12, scale: 2 }).default("0"),
  precioObjetivoKg: decimal("precioObjetivoKg", { precision: 10, scale: 4 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CosteCliente = typeof costesCliente.$inferSelect;
export type InsertCosteCliente = typeof costesCliente.$inferInsert;

// ─── Simulaciones Comerciales ─────────────────────────────────────────────────
export const simulaciones = mysqlTable("simulaciones", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  nombre: varchar("nombre", { length: 128 }),
  estrategia: mysqlEnum("estrategia", ["real", "escalonada", "optimizada", "ventanas", "personalizada"]).notNull(),
  volumenTotalKg: decimal("volumenTotalKg", { precision: 12, scale: 2 }).notNull(),
  precioMedioEstimadoKg: decimal("precioMedioEstimadoKg", { precision: 10, scale: 4 }),
  costeProduccionKg: decimal("costeProduccionKg", { precision: 10, scale: 4 }),
  costeAlmacenamientoKg: decimal("costeAlmacenamientoKg", { precision: 10, scale: 4 }),
  margenEstimadoKg: decimal("margenEstimadoKg", { precision: 10, scale: 4 }),
  beneficioEstimadoTotal: decimal("beneficioEstimadoTotal", { precision: 14, scale: 2 }),
  escenarios: json("escenarios"), // array de escenarios alternativos
  recomendacionIa: text("recomendacionIa"),
  observaciones: text("observaciones"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Simulacion = typeof simulaciones.$inferSelect;
export type InsertSimulacion = typeof simulaciones.$inferInsert;

// ─── Alertas de Precio ────────────────────────────────────────────────────────
export const alertas = mysqlTable("alertas", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  nombre: varchar("nombre", { length: 128 }).notNull(),
  categoria: mysqlEnum("categoria", ["AOVE", "AOV", "AOL", "AOR"]).default("AOVE"),
  tipoAlerta: mysqlEnum("tipoAlerta", ["precio_supera", "precio_baja", "variacion_pct"]).notNull(),
  umbralKg: decimal("umbralKg", { precision: 10, scale: 4 }),
  umbralPct: decimal("umbralPct", { precision: 6, scale: 3 }),
  activa: boolean("activa").default(true),
  notificarEmail: boolean("notificarEmail").default(true),
  ultimaEvaluacion: timestamp("ultimaEvaluacion"),
  ultimaNotificacion: timestamp("ultimaNotificacion"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Alerta = typeof alertas.$inferSelect;
export type InsertAlerta = typeof alertas.$inferInsert;

// ─── Conversaciones del Chatbot ───────────────────────────────────────────────
export const conversaciones = mysqlTable("conversaciones", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  titulo: varchar("titulo", { length: 256 }),
  modeloIa: varchar("modeloIa", { length: 64 }).default("gpt-4"),
  mensajes: json("mensajes").notNull(), // array de {role, content, timestamp}
  contextoMercado: json("contextoMercado"), // snapshot de precios al momento
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversacion = typeof conversaciones.$inferSelect;
export type InsertConversacion = typeof conversaciones.$inferInsert;

// ─── Documentos del Cliente ───────────────────────────────────────────────────
export const documentos = mysqlTable("documentos", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  nombre: varchar("nombre", { length: 256 }).notNull(),
  tipo: mysqlEnum("tipo", ["boletin_mapa", "historico_ventas", "costes", "otro"]).notNull(),
  storageKey: text("storageKey").notNull(),
  storageUrl: text("storageUrl").notNull(),
  tamanoBytes: int("tamanoBytes"),
  extractoTexto: text("extractoTexto"), // texto extraído del PDF para RAG
  procesado: boolean("procesado").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Documento = typeof documentos.$inferSelect;
export type InsertDocumento = typeof documentos.$inferInsert;

// ─── Noticias del Sector ──────────────────────────────────────────────────────
export const noticias = mysqlTable("noticias", {
  id: int("id").autoincrement().primaryKey(),
  titulo: text("titulo").notNull(),
  descripcion: text("descripcion"),
  url: text("url").notNull(),
  fuente: varchar("fuente", { length: 128 }),
  imagen: text("imagen"),
  publicadoEn: timestamp("publicadoEn"),
  categoria: varchar("categoria", { length: 64 }).default("mercado"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Noticia = typeof noticias.$inferSelect;
export type InsertNoticia = typeof noticias.$inferInsert;

// ─── Informes Semanales ───────────────────────────────────────────────────────
export const informes = mysqlTable("informes", {
  id: int("id").autoincrement().primaryKey(),
  semanaIso: varchar("semanaIso", { length: 10 }).notNull(),
  titulo: varchar("titulo", { length: 256 }),
  resumenIa: text("resumenIa"),
  recomendacion: text("recomendacion"),
  htmlContent: text("htmlContent"),
  precioReferencia: decimal("precioReferencia", { precision: 10, scale: 2 }),
  tendencia: varchar("tendencia", { length: 16 }),
  enviado: boolean("enviado").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Informe = typeof informes.$inferSelect;
export type InsertInforme = typeof informes.$inferInsert;
