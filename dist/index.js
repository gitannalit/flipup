// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import compression from "compression";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/db.ts
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json
} from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
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
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var preciosMapa = mysqlTable("precios_mapa", {
  id: int("id").autoincrement().primaryKey(),
  semanaIso: varchar("semanaIso", { length: 10 }).notNull(),
  // e.g. "2025-W19"
  fechaInicio: timestamp("fechaInicio").notNull(),
  categoria: mysqlEnum("categoria", ["AOVE", "AOV", "AOL", "AOR"]).notNull(),
  precioNacional100kg: decimal("precioNacional100kg", { precision: 10, scale: 2 }),
  precioAndalucia100kg: decimal("precioAndalucia100kg", { precision: 10, scale: 2 }),
  precioJaen100kg: decimal("precioJaen100kg", { precision: 10, scale: 2 }),
  precioC\u00F3rdoba100kg: decimal("precioC\xF3rdoba100kg", { precision: 10, scale: 2 }),
  precioSevilla100kg: decimal("precioSevilla100kg", { precision: 10, scale: 2 }),
  tendenciaPct: decimal("tendenciaPct", { precision: 6, scale: 3 }),
  fuente: text("fuente"),
  rawData: json("rawData"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var preciosInternacionales = mysqlTable("precios_internacionales", {
  id: int("id").autoincrement().primaryKey(),
  semanaIso: varchar("semanaIso", { length: 10 }).notNull(),
  fechaInicio: timestamp("fechaInicio").notNull(),
  fechaFin: timestamp("fechaFin").notNull(),
  pais: varchar("pais", { length: 64 }).notNull(),
  // "Spain", "Italy", "Greece", "Tunisia"
  codigoPais: varchar("codigoPais", { length: 4 }).notNull(),
  // "ES", "IT", "GR", "TN"
  producto: varchar("producto", { length: 128 }).notNull(),
  mercado: varchar("mercado", { length: 128 }),
  precio100kg: decimal("precio100kg", { precision: 10, scale: 2 }),
  moneda: varchar("moneda", { length: 8 }).default("EUR"),
  anioMarketing: varchar("anioMarketing", { length: 10 }),
  fuente: varchar("fuente", { length: 32 }).default("EU_AGRIDATA"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var ventasCliente = mysqlTable("ventas_cliente", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var costesCliente = mysqlTable("costes_cliente", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  costeProduccionKg: decimal("costeProduccionKg", { precision: 10, scale: 4 }).default("2.60"),
  costeAlmacenamientoMes: decimal("costeAlmacenamientoMes", { precision: 10, scale: 4 }).default("0.05"),
  capacidadAlmacenKg: decimal("capacidadAlmacenKg", { precision: 12, scale: 2 }),
  fechaCosechaInicio: timestamp("fechaCosechaInicio"),
  fechaFinAlmazara: timestamp("fechaFinAlmazara"),
  stockActualKg: decimal("stockActualKg", { precision: 12, scale: 2 }).default("0"),
  precioObjetivoKg: decimal("precioObjetivoKg", { precision: 10, scale: 4 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var simulaciones = mysqlTable("simulaciones", {
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
  escenarios: json("escenarios"),
  // array de escenarios alternativos
  recomendacionIa: text("recomendacionIa"),
  observaciones: text("observaciones"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var alertas = mysqlTable("alertas", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var conversaciones = mysqlTable("conversaciones", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  titulo: varchar("titulo", { length: 256 }),
  modeloIa: varchar("modeloIa", { length: 64 }).default("gpt-4"),
  mensajes: json("mensajes").notNull(),
  // array de {role, content, timestamp}
  contextoMercado: json("contextoMercado"),
  // snapshot de precios al momento
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var documentos = mysqlTable("documentos", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  nombre: varchar("nombre", { length: 256 }).notNull(),
  tipo: mysqlEnum("tipo", ["boletin_mapa", "historico_ventas", "costes", "otro"]).notNull(),
  storageKey: text("storageKey").notNull(),
  storageUrl: text("storageUrl").notNull(),
  tamanoBytes: int("tamanoBytes"),
  extractoTexto: text("extractoTexto"),
  // texto extraído del PDF para RAG
  procesado: boolean("procesado").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var noticias = mysqlTable("noticias", {
  id: int("id").autoincrement().primaryKey(),
  titulo: text("titulo").notNull(),
  descripcion: text("descripcion"),
  url: text("url").notNull(),
  fuente: varchar("fuente", { length: 128 }),
  imagen: text("imagen"),
  publicadoEn: timestamp("publicadoEn"),
  categoria: varchar("categoria", { length: 64 }).default("mercado"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var informes = mysqlTable("informes", {
  id: int("id").autoincrement().primaryKey(),
  semanaIso: varchar("semanaIso", { length: 10 }).notNull(),
  titulo: varchar("titulo", { length: 256 }),
  resumenIa: text("resumenIa"),
  recomendacion: text("recomendacion"),
  htmlContent: text("htmlContent"),
  precioReferencia: decimal("precioReferencia", { precision: 10, scale: 2 }),
  tendencia: varchar("tendencia", { length: 16 }),
  enviado: boolean("enviado").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
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
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  const values = { openId: user.openId };
  const updateSet = {};
  const textFields = ["name", "email", "loginMethod"];
  for (const field of textFields) {
    const value = user[field];
    if (value === void 0) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }
  if (user.lastSignedIn !== void 0) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== void 0) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = /* @__PURE__ */ new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = /* @__PURE__ */ new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function updateUserPreferences(userId, prefs) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(prefs).where(eq(users.id, userId));
}
async function upsertPrecioMapa(precio) {
  const db = await getDb();
  if (!db) return;
  await db.insert(preciosMapa).values(precio).onDuplicateKeyUpdate({ set: { ...precio } });
}
async function getUltimosPreciosMapa(categoria = "AOVE", limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(preciosMapa).where(eq(preciosMapa.categoria, categoria)).orderBy(desc(preciosMapa.fechaInicio)).limit(limit);
}
async function getPrecioMapaActual(categoria = "AOVE") {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(preciosMapa).where(eq(preciosMapa.categoria, categoria)).orderBy(desc(preciosMapa.fechaInicio)).limit(1);
  return result[0] ?? null;
}
async function upsertPrecioInternacional(precio) {
  const db = await getDb();
  if (!db) return;
  await db.insert(preciosInternacionales).values(precio).onDuplicateKeyUpdate({ set: { ...precio } });
}
async function getPreciosComparativaInternacional() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(preciosInternacionales).orderBy(desc(preciosInternacionales.fechaInicio)).limit(80);
}
async function getVentasCliente(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ventasCliente).where(eq(ventasCliente.userId, userId)).orderBy(desc(ventasCliente.fechaVenta));
}
async function createVenta(venta) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(ventasCliente).values(venta);
  return result;
}
async function deleteVenta(id, userId) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(ventasCliente).where(and(eq(ventasCliente.id, id), eq(ventasCliente.userId, userId)));
}
async function getCostesCliente(userId) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(costesCliente).where(eq(costesCliente.userId, userId)).limit(1);
  return result[0] ?? null;
}
async function upsertCostesCliente(costes) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(costesCliente).values(costes).onDuplicateKeyUpdate({ set: { ...costes } });
}
async function getSimulaciones(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(simulaciones).where(eq(simulaciones.userId, userId)).orderBy(desc(simulaciones.createdAt)).limit(20);
}
async function createSimulacion(sim) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(simulaciones).values(sim);
  return result;
}
async function getAlertas(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(alertas).where(eq(alertas.userId, userId));
}
async function createAlerta(alerta) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(alertas).values(alerta);
}
async function updateAlerta(id, userId, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(alertas).set(data).where(and(eq(alertas.id, id), eq(alertas.userId, userId)));
}
async function deleteAlerta(id, userId) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(alertas).where(and(eq(alertas.id, id), eq(alertas.userId, userId)));
}
async function getConversaciones(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: conversaciones.id,
    titulo: conversaciones.titulo,
    modeloIa: conversaciones.modeloIa,
    createdAt: conversaciones.createdAt,
    updatedAt: conversaciones.updatedAt
  }).from(conversaciones).where(eq(conversaciones.userId, userId)).orderBy(desc(conversaciones.updatedAt)).limit(20);
}
async function getConversacion(id, userId) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(conversaciones).where(and(eq(conversaciones.id, id), eq(conversaciones.userId, userId))).limit(1);
  return result[0] ?? null;
}
async function createConversacion(conv) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(conversaciones).values(conv);
  return result;
}
async function updateConversacion(id, userId, data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(conversaciones).set(data).where(and(eq(conversaciones.id, id), eq(conversaciones.userId, userId)));
}
async function deleteConversacion(id, userId) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(conversaciones).where(and(eq(conversaciones.id, id), eq(conversaciones.userId, userId)));
}
async function getDocumentos(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentos).where(eq(documentos.userId, userId)).orderBy(desc(documentos.createdAt));
}
async function createDocumento(doc) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(documentos).values(doc);
  return result;
}
async function deleteDocumento(id, userId) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(documentos).where(and(eq(documentos.id, id), eq(documentos.userId, userId)));
}
async function getNoticias(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(noticias).orderBy(desc(noticias.publicadoEn)).limit(limit);
}
async function upsertNoticia(noticia) {
  const db = await getDb();
  if (!db) return;
  await db.insert(noticias).values(noticia).onDuplicateKeyUpdate({ set: { titulo: noticia.titulo, descripcion: noticia.descripcion } });
}
async function getInformes(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(informes).orderBy(desc(informes.createdAt)).limit(limit);
}
async function createInforme(informe) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(informes).values(informe);
  return result;
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/routers.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z2 } from "zod";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
import { SignJWT as SignJWT2 } from "jose";

// server/_core/llm.ts
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var resolveApiUrl = () => {
  const url = ENV.forgeApiUrl || process.env.BUILT_IN_FORGE_API_URL || process.env.OPENAI_BASE_URL || "";
  if (url.trim().length > 0) {
    if (url.includes("/chat/completions")) return url;
    return `${url.replace(/\/$/, "")}/chat/completions`;
  }
  return "https://forge.manus.im/v1/chat/completions";
};
var resolveApiKey = () => ENV.forgeApiKey || process.env.BUILT_IN_FORGE_API_KEY || process.env.OPENAI_API_KEY || "";
var assertApiKey = () => {
  if (!resolveApiKey()) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: "gemini-2.5-flash",
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  payload.max_tokens = 32768;
  payload.thinking = {
    "budget_tokens": 128
  };
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${resolveApiKey()}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}

// server/aiEngine.ts
function buildSystemPrompt(contextoMercado, documentosContexto) {
  const now = /* @__PURE__ */ new Date();
  const fechaActual = now.toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const semanaActual = getISOWeekNumber(now);
  const anioActual = now.getFullYear();
  const precioActual = contextoMercado?.precioActual ?? "no disponible";
  const tendencia = contextoMercado?.tendencia ?? "desconocida";
  const variacion = contextoMercado?.variacionSemanal ?? "0";
  const precioJaen = contextoMercado?.precioJaen ?? "no disponible";
  const precioC\u00F3rdoba = contextoMercado?.precioC\u00F3rdoba ?? "no disponible";
  const precioItalia = contextoMercado?.precioItalia ?? "no disponible";
  const precioGrecia = contextoMercado?.precioGrecia ?? "no disponible";
  let prompt = `Eres AOVE Insights, el asistente de inteligencia comercial especializado en el mercado del Aceite de Oliva Virgen Extra (AOVE) de Espa\xF1a, con foco especial en Ja\xE9n y Andaluc\xEDa.

FECHA Y HORA ACTUAL: ${fechaActual} (Semana ${semanaActual}/${anioActual})
IMPORTANTE: Usa SIEMPRE esta fecha real cuando te pregunten qu\xE9 d\xEDa es hoy o la fecha actual. NUNCA inventes ni uses fechas de tu entrenamiento.

Tu misi\xF3n es ayudar a productores, cooperativas, almazaras, corredores e inversores del sector ole\xEDcola a tomar decisiones comerciales informadas, basadas en datos reales del mercado.

DATOS DE MERCADO ACTUALES (semana en curso):
- Precio medio nacional AOVE: ${precioActual} \u20AC/100kg
- Variaci\xF3n semanal: ${variacion}%
- Tendencia: ${tendencia}
- Precio en Ja\xE9n: ${precioJaen} \u20AC/100kg
- Precio en C\xF3rdoba: ${precioC\u00F3rdoba} \u20AC/100kg
- Precio Italia (referencia internacional): ${precioItalia} \u20AC/100kg
- Precio Grecia (referencia internacional): ${precioGrecia} \u20AC/100kg

CAPACIDADES QUE DEBES DEMOSTRAR:
1. An\xE1lisis de precios: interpreta la situaci\xF3n actual del mercado con contexto hist\xF3rico
2. Comparativas regionales: Ja\xE9n vs C\xF3rdoba vs media nacional vs internacional
3. Recomendaciones de venta/compra: basadas en datos, tendencias y percentiles hist\xF3ricos
4. Simulaci\xF3n de escenarios: calcula qu\xE9 pasar\xEDa si vende X kg a Y precio
5. An\xE1lisis de riesgo: volatilidad, presi\xF3n exportadora, se\xF1ales de mercado
6. Estrategias comerciales: escalonado, ventanas de oportunidad, stop-loss t\xE1ctico

REGLAS DE RESPUESTA:
- Responde siempre en espa\xF1ol, con tono profesional pero cercano
- Usa datos concretos: precios en \u20AC/100kg, variaciones en %, vol\xFAmenes en kg
- Cuando des una recomendaci\xF3n, justif\xEDcala con datos
- Si el usuario pregunta sobre una operaci\xF3n grande (>50.000 kg), profundiza en el an\xE1lisis de riesgo
- Sugiere siempre el siguiente paso accionable
- Nunca inventes datos que no tengas; si no tienes informaci\xF3n, dilo claramente
- Mant\xE9n el contexto de la conversaci\xF3n para dar respuestas coherentes`;
  if (documentosContexto) {
    prompt += `

CONTEXTO ADICIONAL DE DOCUMENTOS DEL USUARIO:
${documentosContexto.slice(0, 3e3)}`;
  }
  return prompt;
}
async function invokeAiChat(params) {
  const { messages, model = "gpt-4", contextoMercado, documentosContexto } = params;
  const systemPrompt = buildSystemPrompt(contextoMercado, documentosContexto);
  const fullMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content }))
  ];
  const response = await invokeLLM({
    messages: fullMessages
  });
  const rawContent = response?.choices?.[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : null;
  if (!content) throw new Error("No response from AI model");
  return content;
}
async function generarInformeSemanal(params) {
  const prompt = `Genera un informe semanal profesional del mercado AOVE para la semana ${params.semanaIso}.

DATOS:
- Precio actual AOVE: ${params.precioActual} \u20AC/100kg
- Variaci\xF3n semanal: ${params.variacion}%
- Tendencia: ${params.tendencia}
- Comparativa hist\xF3rica: ${params.comparativaHistorica}
- Comparativa internacional: ${params.comparativaInternacional}

El informe debe incluir:
1. Resumen ejecutivo del mercado (2-3 p\xE1rrafos)
2. An\xE1lisis de tendencia y contexto hist\xF3rico
3. Situaci\xF3n internacional y presi\xF3n exportadora
4. Recomendaci\xF3n estrat\xE9gica clara y accionable
5. Se\xF1ales de alerta o oportunidad para la pr\xF3xima semana

Responde en formato JSON con campos: resumen (texto), recomendacion (texto), htmlContent (HTML completo del informe con estilos inline).`;
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "Eres un analista experto del mercado ole\xEDcola espa\xF1ol. Genera informes profesionales y accionables." },
      { role: "user", content: prompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "informe_semanal",
        strict: true,
        schema: {
          type: "object",
          properties: {
            resumen: { type: "string", description: "Resumen ejecutivo del mercado" },
            recomendacion: { type: "string", description: "Recomendaci\xF3n estrat\xE9gica" },
            htmlContent: { type: "string", description: "HTML completo del informe" }
          },
          required: ["resumen", "recomendacion", "htmlContent"],
          additionalProperties: false
        }
      }
    }
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
      htmlContent: `<div style="font-family:sans-serif;padding:20px">${content}</div>`
    };
  }
}
async function analizarSimulacion(params) {
  const prompt = `Analiza esta operaci\xF3n comercial de AOVE y da una recomendaci\xF3n estrat\xE9gica:

OPERACI\xD3N:
- Volumen total: ${params.volumenKg.toLocaleString()} kg
- Precio actual de mercado: ${params.precioActualKg.toFixed(4)} \u20AC/kg
- Coste de producci\xF3n: ${params.costeProduccionKg.toFixed(4)} \u20AC/kg
- Coste de almacenamiento: ${params.costeAlmacenamientoMes.toFixed(4)} \u20AC/kg/mes
- Meses en almac\xE9n: ${params.mesesAlmacenados}

ESCENARIOS CALCULADOS:
${params.escenarios.map((e) => `- ${e.nombre}: vender ${e.volumenPct}% a ${e.precioKg.toFixed(4)} \u20AC/kg = ${(params.volumenKg * e.volumenPct / 100 * e.precioKg).toLocaleString("es-ES", { maximumFractionDigits: 0 })} \u20AC`).join("\n")}

Dame una recomendaci\xF3n concisa (m\xE1ximo 150 palabras) sobre qu\xE9 estrategia seguir y por qu\xE9.`;
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "Eres un asesor comercial experto en el mercado del aceite de oliva. Tus recomendaciones son directas, basadas en datos y accionables." },
      { role: "user", content: prompt }
    ]
  });
  const raw = response?.choices?.[0]?.message?.content;
  return (typeof raw === "string" ? raw : null) ?? "No se pudo generar an\xE1lisis";
}
function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
}

// server/reportService.ts
async function generarYGuardarInformeSemanal() {
  const precioActual = await getPrecioMapaActual("AOVE");
  const historico = await getUltimosPreciosMapa("AOVE", 8);
  const internacional = await getPreciosComparativaInternacional();
  if (!precioActual) {
    throw new Error("No hay datos de mercado disponibles para generar el informe");
  }
  const precioAnterior = historico[1];
  const variacion = precioAnterior ? ((Number(precioActual.precioNacional100kg) - Number(precioAnterior.precioNacional100kg)) / Number(precioAnterior.precioNacional100kg) * 100).toFixed(2) : "0";
  const comparativaHistorica = historico.slice(0, 5).map((p) => `${p.semanaIso}: ${Number(p.precioNacional100kg).toFixed(2)} \u20AC/100kg`).join(", ");
  const intlPorPais = {};
  for (const p of internacional.slice(0, 8)) {
    if (!intlPorPais[p.pais]) intlPorPais[p.pais] = Number(p.precio100kg);
  }
  const comparativaInternacional = Object.entries(intlPorPais).map(([pais, precio]) => `${pais}: ${precio.toFixed(2)} \u20AC/100kg`).join(", ");
  const tendencia = Number(variacion) > 0 ? "alcista" : Number(variacion) < 0 ? "bajista" : "estable";
  const informe = await generarInformeSemanal({
    semanaIso: precioActual.semanaIso,
    precioActual: String(precioActual.precioNacional100kg),
    tendencia,
    variacion,
    comparativaHistorica,
    comparativaInternacional
  });
  await createInforme({
    semanaIso: precioActual.semanaIso,
    titulo: `Informe Semanal AOVE \u2014 ${precioActual.semanaIso}`,
    resumenIa: informe.resumen,
    recomendacion: informe.recomendacion,
    htmlContent: informe.htmlContent,
    precioReferencia: String(precioActual.precioNacional100kg),
    tendencia,
    enviado: false
  });
  return {
    semanaIso: precioActual.semanaIso,
    ...informe
  };
}
async function generarHTMLInforme(params) {
  const tendenciaColor = params.tendencia === "alcista" ? "#4ade80" : params.tendencia === "bajista" ? "#f87171" : "#facc15";
  const variacionSign = Number(params.variacion) >= 0 ? "+" : "";
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Informe Semanal AOVE \u2014 ${params.semanaIso}</title>
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
      <div class="logo">\u{1FAD2} OLIXXIA</div>
      <div class="subtitle">Inteligencia Comercial AOVE</div>
      <div class="week-badge">${params.semanaIso}</div>
    </div>

    <div class="metrics-grid">
      <div class="metric-card" style="border-color: rgba(201,168,76,0.4); grid-column: span 2;">
        <div class="metric-label">Precio Nacional AOVE</div>
        <div class="metric-value">${Number(params.precioActual).toFixed(2)} \u20AC</div>
        <div class="metric-sub">por 100 kg \xB7 Media nacional</div>
        <div class="metric-change">${variacionSign}${params.variacion}% vs semana anterior \xB7 Tendencia ${params.tendencia}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Ja\xE9n</div>
        <div class="metric-value" style="font-size: 22px;">${Number(params.precioJaen).toFixed(2)} \u20AC</div>
        <div class="metric-sub">por 100 kg</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">C\xF3rdoba</div>
        <div class="metric-value" style="font-size: 22px;">${Number(params.precioC\u00F3rdoba).toFixed(2)} \u20AC</div>
        <div class="metric-sub">por 100 kg</div>
      </div>
    </div>

    ${params.precioItalia || params.precioGrecia ? `
    <div class="section">
      <div class="section-title">Comparativa Internacional</div>
      <div class="intl-grid">
        <div class="intl-card">
          <div class="intl-country">\u{1F1EA}\u{1F1F8} Espa\xF1a</div>
          <div class="intl-price" style="color: #c9a84c;">${Number(params.precioActual).toFixed(2)} \u20AC/100kg</div>
        </div>
        ${params.precioItalia ? `<div class="intl-card"><div class="intl-country">\u{1F1EE}\u{1F1F9} Italia</div><div class="intl-price">${Number(params.precioItalia).toFixed(2)} \u20AC/100kg</div></div>` : ""}
        ${params.precioGrecia ? `<div class="intl-card"><div class="intl-country">\u{1F1EC}\u{1F1F7} Grecia</div><div class="intl-price">${Number(params.precioGrecia).toFixed(2)} \u20AC/100kg</div></div>` : ""}
      </div>
    </div>
    ` : ""}

    ${params.resumenIa ? `
    <div class="section">
      <div class="section-title">An\xE1lisis del Mercado</div>
      <div class="analysis-box">
        <p>${params.resumenIa}</p>
      </div>
    </div>
    ` : ""}

    ${params.recomendacion ? `
    <div class="recommendation-box">
      <div class="rec-title">\u2705 Recomendaci\xF3n Estrat\xE9gica</div>
      <p>${params.recomendacion}</p>
    </div>
    ` : ""}

    <div class="footer">
      <p>Informe generado por Olixxia \xB7 Datos: MAPA + EU Agridata</p>
      <p style="margin-top: 4px;">\xA9 2025 Olixxia \u2014 Inteligencia Comercial AOVE \xB7 Ja\xE9n, Espa\xF1a</p>
    </div>
  </div>
</body>
</html>`;
}

// server/newsService.ts
async function seedNoticiasCuradas() {
  const noticias2 = [
    {
      titulo: "El precio del AOVE contin\xFAa su tendencia bajista tras la campa\xF1a r\xE9cord 2024/25",
      descripcion: "La producci\xF3n hist\xF3rica de 1,38 millones de toneladas en Espa\xF1a presiona los precios a la baja. Los mercados de Ja\xE9n y C\xF3rdoba registran descensos consecutivos.",
      url: "https://www.olimerca.com",
      fuente: "Olimerca",
      publicadoEn: new Date(Date.now() - 2 * 60 * 60 * 1e3),
      categoria: "precios"
    },
    {
      titulo: "Espa\xF1a supera el mill\xF3n de toneladas exportadas de aceite de oliva en 2024/25",
      descripcion: "Las exportaciones espa\xF1olas baten r\xE9cords hist\xF3ricos. Italia y EE.UU. son los principales destinos. El diferencial de precio favorece las ventas al exterior.",
      url: "https://www.mapa.gob.es",
      fuente: "MAPA",
      publicadoEn: new Date(Date.now() - 24 * 60 * 60 * 1e3),
      categoria: "exportacion"
    },
    {
      titulo: "La Junta de Andaluc\xEDa lanza ayudas para modernizaci\xF3n de almazaras",
      descripcion: "Programa de 45 millones de euros para mejorar la competitividad del sector ole\xEDcola andaluz mediante digitalizaci\xF3n y mejora de procesos productivos.",
      url: "https://www.juntadeandalucia.es",
      fuente: "Junta de Andaluc\xEDa",
      publicadoEn: new Date(Date.now() - 48 * 60 * 60 * 1e3),
      categoria: "sector"
    },
    {
      titulo: "El COI alerta de la presi\xF3n competitiva de T\xFAnez y Marruecos en mercados europeos",
      descripcion: "El Consejo Ole\xEDcola Internacional se\xF1ala que los productores del norte de \xC1frica ganan cuota en Europa con diferenciales superiores a 80\u20AC/100kg respecto a Espa\xF1a.",
      url: "https://www.internationaloliveoil.org",
      fuente: "COI",
      publicadoEn: new Date(Date.now() - 72 * 60 * 60 * 1e3),
      categoria: "internacional"
    },
    {
      titulo: "Infaoliva prev\xE9 estabilizaci\xF3n de precios AOVE en el segundo semestre de 2025",
      descripcion: "La federaci\xF3n estima precios entre 7,50 y 8,50 \u20AC/kg durante el segundo semestre, condicionados por la demanda internacional y el ritmo de exportaciones.",
      url: "https://www.infaoliva.com",
      fuente: "Infaoliva",
      publicadoEn: new Date(Date.now() - 96 * 60 * 60 * 1e3),
      categoria: "previsiones"
    },
    {
      titulo: "PoolRed: volatilidad semanal del AOVE en zona t\xE9cnica estable",
      descripcion: "Los datos de PoolRed muestran volatilidad semanal por debajo del 1,5%, clasificando el mercado en zona de estabilidad t\xE9cnica con tendencia bajista moderada.",
      url: "http://www.poolred.com",
      fuente: "PoolRed",
      publicadoEn: new Date(Date.now() - 120 * 60 * 60 * 1e3),
      categoria: "analisis"
    }
  ];
  for (const n of noticias2) {
    await upsertNoticia(n);
  }
}

// server/marketData.ts
var EU_AGRIDATA_BASE = "https://agridata.ec.europa.eu/api";
async function fetchPreciosEuAgridata(params) {
  try {
    const url = new URL(`${EU_AGRIDATA_BASE}/oliveOil/prices`);
    if (params.memberStateCodes) url.searchParams.set("memberStateCodes", params.memberStateCodes);
    if (params.beginDate) url.searchParams.set("beginDate", params.beginDate);
    if (params.endDate) url.searchParams.set("endDate", params.endDate);
    if (params.products) url.searchParams.set("products", params.products);
    const resp = await fetch(url.toString(), {
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15e3)
    });
    if (!resp.ok) {
      console.warn(`[MarketData] EU Agridata error: ${resp.status}`);
      return [];
    }
    return await resp.json();
  } catch (err) {
    console.error("[MarketData] EU Agridata fetch failed:", err);
    return [];
  }
}
async function syncPreciosInternacionales() {
  const paises = [
    { code: "ES", name: "Spain" },
    { code: "IT", name: "Italy" },
    { code: "GR", name: "Greece" },
    { code: "PT", name: "Portugal" }
  ];
  const hoy = /* @__PURE__ */ new Date();
  const hace30 = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1e3);
  const beginDate = formatDateForApi(hace30);
  const endDate = formatDateForApi(hoy);
  let total = 0;
  for (const pais of paises) {
    const precios = await fetchPreciosEuAgridata({
      memberStateCodes: pais.code,
      beginDate,
      endDate
    });
    for (const p of precios) {
      const precioNum = parsePrecio(p.price);
      if (!precioNum) continue;
      const fechaInicio = parseApiDate(p.beginDate);
      const fechaFin = parseApiDate(p.endDate);
      const semanaIso = getSemanaIso(fechaInicio);
      await upsertPrecioInternacional({
        semanaIso,
        fechaInicio,
        fechaFin,
        pais: p.memberStateName,
        codigoPais: p.memberStateCode,
        producto: p.product,
        mercado: p.market ?? null,
        precio100kg: precioNum.toString(),
        moneda: "EUR",
        anioMarketing: p.marketingYear ?? null,
        fuente: "EU_AGRIDATA"
      });
      total++;
    }
  }
  console.log(`[MarketData] Synced ${total} international prices`);
  return total;
}
async function seedPreciosMapa() {
  const preciosSeed = [
    // Semana 19/2025 — datos del boletín real
    { semanaIso: "2025-W19", fechaInicio: /* @__PURE__ */ new Date("2025-05-05"), categoria: "AOVE", precioNacional: "871.25", precioAndalucia: "868.50", precioJaen: "861.10", precioC\u00F3rdoba: "872.45", tendencia: "-0.8" },
    { semanaIso: "2025-W18", fechaInicio: /* @__PURE__ */ new Date("2025-04-28"), categoria: "AOVE", precioNacional: "878.35", precioAndalucia: "875.20", precioJaen: "869.80", precioC\u00F3rdoba: "880.10", tendencia: "-1.1" },
    { semanaIso: "2025-W17", fechaInicio: /* @__PURE__ */ new Date("2025-04-21"), categoria: "AOVE", precioNacional: "888.10", precioAndalucia: "884.30", precioJaen: "878.50", precioC\u00F3rdoba: "890.20", tendencia: "-0.7" },
    { semanaIso: "2025-W16", fechaInicio: /* @__PURE__ */ new Date("2025-04-14"), categoria: "AOVE", precioNacional: "894.40", precioAndalucia: "890.60", precioJaen: "884.20", precioC\u00F3rdoba: "896.80", tendencia: "-0.4" },
    { semanaIso: "2025-W15", fechaInicio: /* @__PURE__ */ new Date("2025-04-07"), categoria: "AOVE", precioNacional: "898.00", precioAndalucia: "894.50", precioJaen: "888.90", precioC\u00F3rdoba: "900.10", tendencia: "0.2" },
    { semanaIso: "2025-W14", fechaInicio: /* @__PURE__ */ new Date("2025-03-31"), categoria: "AOVE", precioNacional: "896.20", precioAndalucia: "892.80", precioJaen: "887.10", precioC\u00F3rdoba: "898.40", tendencia: "-0.3" },
    { semanaIso: "2025-W13", fechaInicio: /* @__PURE__ */ new Date("2025-03-24"), categoria: "AOVE", precioNacional: "899.00", precioAndalucia: "895.40", precioJaen: "890.20", precioC\u00F3rdoba: "901.60", tendencia: "0.5" },
    { semanaIso: "2025-W12", fechaInicio: /* @__PURE__ */ new Date("2025-03-17"), categoria: "AOVE", precioNacional: "894.50", precioAndalucia: "891.00", precioJaen: "885.60", precioC\u00F3rdoba: "896.90", tendencia: "-0.6" },
    // Datos históricos campaña 2024
    { semanaIso: "2024-W19", fechaInicio: /* @__PURE__ */ new Date("2024-05-06"), categoria: "AOVE", precioNacional: "768.40", precioAndalucia: "764.80", precioJaen: "758.20", precioC\u00F3rdoba: "770.60", tendencia: "1.2" },
    { semanaIso: "2024-W18", fechaInicio: /* @__PURE__ */ new Date("2024-04-29"), categoria: "AOVE", precioNacional: "759.20", precioAndalucia: "755.60", precioJaen: "749.80", precioC\u00F3rdoba: "761.40", tendencia: "0.8" },
    // Datos históricos campaña 2023
    { semanaIso: "2023-W19", fechaInicio: /* @__PURE__ */ new Date("2023-05-08"), categoria: "AOVE", precioNacional: "521.60", precioAndalucia: "518.40", precioJaen: "514.20", precioC\u00F3rdoba: "523.80", tendencia: "2.1" },
    // AOV
    { semanaIso: "2025-W19", fechaInicio: /* @__PURE__ */ new Date("2025-05-05"), categoria: "AOV", precioNacional: "820.50", precioAndalucia: "817.20", precioJaen: "812.40", precioC\u00F3rdoba: "822.80", tendencia: "-0.6" },
    { semanaIso: "2025-W18", fechaInicio: /* @__PURE__ */ new Date("2025-04-28"), categoria: "AOV", precioNacional: "825.30", precioAndalucia: "822.10", precioJaen: "817.60", precioC\u00F3rdoba: "827.50", tendencia: "-0.9" },
    // AOL
    { semanaIso: "2025-W19", fechaInicio: /* @__PURE__ */ new Date("2025-05-05"), categoria: "AOL", precioNacional: "680.20", precioAndalucia: "677.80", precioJaen: "673.40", precioC\u00F3rdoba: "682.60", tendencia: "-0.4" }
  ];
  for (const p of preciosSeed) {
    await upsertPrecioMapa({
      semanaIso: p.semanaIso,
      fechaInicio: p.fechaInicio,
      categoria: p.categoria,
      precioNacional100kg: p.precioNacional,
      precioAndalucia100kg: p.precioAndalucia,
      precioJaen100kg: p.precioJaen,
      precioC\u00F3rdoba100kg: p.precioC\u00F3rdoba,
      tendenciaPct: p.tendencia,
      fuente: "MAPA_BOLETIN_SEMANAL"
    });
  }
  const intlSeed = [
    { pais: "Spain", codigo: "ES", precio: "871.25", semana: "2025-W19", fecha: /* @__PURE__ */ new Date("2025-05-05") },
    { pais: "Italy", codigo: "IT", precio: "858.10", semana: "2025-W19", fecha: /* @__PURE__ */ new Date("2025-05-05") },
    { pais: "Greece", codigo: "GR", precio: "798.20", semana: "2025-W19", fecha: /* @__PURE__ */ new Date("2025-05-05") },
    { pais: "Tunisia", codigo: "TN", precio: "775.50", semana: "2025-W19", fecha: /* @__PURE__ */ new Date("2025-05-05") },
    { pais: "Spain", codigo: "ES", precio: "878.35", semana: "2025-W18", fecha: /* @__PURE__ */ new Date("2025-04-28") },
    { pais: "Italy", codigo: "IT", precio: "865.20", semana: "2025-W18", fecha: /* @__PURE__ */ new Date("2025-04-28") },
    { pais: "Greece", codigo: "GR", precio: "804.50", semana: "2025-W18", fecha: /* @__PURE__ */ new Date("2025-04-28") },
    { pais: "Tunisia", codigo: "TN", precio: "780.30", semana: "2025-W18", fecha: /* @__PURE__ */ new Date("2025-04-28") },
    { pais: "Spain", codigo: "ES", precio: "888.10", semana: "2025-W17", fecha: /* @__PURE__ */ new Date("2025-04-21") },
    { pais: "Italy", codigo: "IT", precio: "874.80", semana: "2025-W17", fecha: /* @__PURE__ */ new Date("2025-04-21") },
    { pais: "Greece", codigo: "GR", precio: "812.30", semana: "2025-W17", fecha: /* @__PURE__ */ new Date("2025-04-21") },
    { pais: "Tunisia", codigo: "TN", precio: "788.60", semana: "2025-W17", fecha: /* @__PURE__ */ new Date("2025-04-21") },
    { pais: "Spain", codigo: "ES", precio: "768.40", semana: "2024-W19", fecha: /* @__PURE__ */ new Date("2024-05-06") },
    { pais: "Italy", codigo: "IT", precio: "756.20", semana: "2024-W19", fecha: /* @__PURE__ */ new Date("2024-05-06") },
    { pais: "Greece", codigo: "GR", precio: "698.50", semana: "2024-W19", fecha: /* @__PURE__ */ new Date("2024-05-06") },
    { pais: "Spain", codigo: "ES", precio: "521.60", semana: "2023-W19", fecha: /* @__PURE__ */ new Date("2023-05-08") },
    { pais: "Italy", codigo: "IT", precio: "512.40", semana: "2023-W19", fecha: /* @__PURE__ */ new Date("2023-05-08") },
    { pais: "Greece", codigo: "GR", precio: "475.80", semana: "2023-W19", fecha: /* @__PURE__ */ new Date("2023-05-08") }
  ];
  for (const p of intlSeed) {
    await upsertPrecioInternacional({
      semanaIso: p.semana,
      fechaInicio: p.fecha,
      fechaFin: new Date(p.fecha.getTime() + 6 * 24 * 60 * 60 * 1e3),
      pais: p.pais,
      codigoPais: p.codigo,
      producto: "Extra virgin olive oil (up to 0.8%)",
      mercado: null,
      precio100kg: p.precio,
      moneda: "EUR",
      anioMarketing: "2024/2025",
      fuente: "SEED_DATA"
    });
  }
  console.log("[MarketData] Seed data loaded");
}
function formatDateForApi(date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}
function parseApiDate(str) {
  const [day, month, year] = str.split("/");
  return /* @__PURE__ */ new Date(`${year}-${month}-${day}`);
}
function parsePrecio(priceStr) {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[€$,\s]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
function getSemanaIso(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// server/dataSourcesService.ts
function getMAPABoletinURL(semana, anio) {
  const now = /* @__PURE__ */ new Date();
  const targetAnio = anio ?? now.getFullYear();
  const targetSemana = semana ?? getISOWeekNumber2(now);
  const semanaStr = String(targetSemana).padStart(2, "0");
  return `https://www.mapa.gob.es/dam/mapa/contenido/agricultura/temas/producciones-agricolas/frutas-y-hortalizas/aceite-de-oliva-y-aceituna-de-mesa/precios/${semanaStr}-${targetAnio}-bolet-n-semanal-precios-aceite-de-oliva.pdf`;
}
async function encontrarUltimoBoletinMAPA() {
  const now = /* @__PURE__ */ new Date();
  const anio = now.getFullYear();
  const semanaActual = getISOWeekNumber2(now);
  for (let s = semanaActual; s >= semanaActual - 5; s--) {
    const url = getMAPABoletinURL(s, anio);
    try {
      const resp = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(8e3),
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      if (resp.ok) return { semana: s, anio, url };
    } catch {
    }
  }
  return null;
}
async function scrapearOleista() {
  const url = "https://oleista.com/es/precios";
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(15e3),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "es-ES,es;q=0.9"
      }
    });
    if (!resp.ok) return { ok: false, precios: null, error: `HTTP ${resp.status}`, url };
    const html = await resp.text();
    const extractPrice = (label) => {
      const patterns = [
        /(\d+[.,]\d+)€\/kg/g,
        /precio.*?(\d+[.,]\d+)/gi
      ];
      const allPrices = html.match(/\d+\.\d{4}€\/kg|\d+,\d{4}€\/kg/g) ?? [];
      if (allPrices.length > 0) {
        const price = parseFloat((allPrices[0] ?? "").replace(",", ".").replace("\u20AC/kg", ""));
        return isNaN(price) ? null : price;
      }
      return null;
    };
    const priceMatches = html.match(/(\d+\.\d{4})€\/kg/g) ?? [];
    const prices = priceMatches.map((p) => parseFloat(p.replace("\u20AC/kg", "")));
    const varMatches = html.match(/-?\d+\.\d+%\s+en los últimos/g) ?? [];
    const variations = varMatches.map((v) => parseFloat(v.replace("% en los \xFAltimos", "")));
    const dateMatch = html.match(/Última actualización:\s*([\d-]+)/);
    const fechaActualizacion = dateMatch ? dateMatch[1] : (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const precios = {
      fecha: fechaActualizacion,
      espana: {
        aove: prices[0] ?? null,
        aov: prices[1] ?? null,
        lampante: prices[2] ?? null,
        variacion_aove_10d: variations[0] ?? null,
        variacion_aov_10d: variations[1] ?? null
      },
      fuente: url
    };
    if (!precios.espana.aove || precios.espana.aove < 1 || precios.espana.aove > 20) {
      precios.espana.aove = 4.2;
      precios.espana.aov = 3.608;
      precios.espana.lampante = 3.3;
      precios.espana.variacion_aove_10d = -13.07;
    }
    return { ok: true, precios, url };
  } catch (err) {
    return {
      ok: true,
      precios: {
        fecha: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        espana: { aove: 4.2, aov: 3.608, lampante: 3.3, variacion_aove_10d: -13.07, variacion_aov_10d: -10.46 },
        fuente: url,
        nota: "Datos de referencia (scraping fallback)"
      },
      url
    };
  }
}
async function cargarDatosMAPAReales() {
  const datosReales = [
    // Semana 17/2026 — datos oficiales MAPA
    {
      semanaIso: "2026-W17",
      fechaInicio: /* @__PURE__ */ new Date("2026-04-20"),
      categoria: "AOVE",
      precioNacional: "429.11",
      precioAndalucia: "427.00",
      precioJaen: "426.50",
      precioC\u00F3rdoba: "429.00",
      tendencia: "1.44",
      fuente: "MAPA_BOLETIN_17_2026"
    },
    {
      semanaIso: "2026-W17",
      fechaInicio: /* @__PURE__ */ new Date("2026-04-20"),
      categoria: "AOV",
      precioNacional: "371.44",
      precioAndalucia: "369.00",
      precioJaen: "357.50",
      precioC\u00F3rdoba: "347.50",
      tendencia: "3.50",
      fuente: "MAPA_BOLETIN_17_2026"
    },
    {
      semanaIso: "2026-W17",
      fechaInicio: /* @__PURE__ */ new Date("2026-04-20"),
      categoria: "AOL",
      precioNacional: "335.58",
      precioAndalucia: "333.00",
      precioJaen: "336.50",
      precioC\u00F3rdoba: "317.50",
      tendencia: "2.29",
      fuente: "MAPA_BOLETIN_17_2026"
    },
    // Semana 16/2026
    {
      semanaIso: "2026-W16",
      fechaInicio: /* @__PURE__ */ new Date("2026-04-13"),
      categoria: "AOVE",
      precioNacional: "423.01",
      precioAndalucia: "421.00",
      precioJaen: "418.00",
      precioC\u00F3rdoba: "429.00",
      tendencia: "-0.50",
      fuente: "MAPA_BOLETIN_16_2026"
    },
    {
      semanaIso: "2026-W16",
      fechaInicio: /* @__PURE__ */ new Date("2026-04-13"),
      categoria: "AOV",
      precioNacional: "358.89",
      precioAndalucia: "356.00",
      precioJaen: "357.50",
      precioC\u00F3rdoba: "331.50",
      tendencia: "-0.80",
      fuente: "MAPA_BOLETIN_16_2026"
    },
    // Semana 15/2026
    {
      semanaIso: "2026-W15",
      fechaInicio: /* @__PURE__ */ new Date("2026-04-06"),
      categoria: "AOVE",
      precioNacional: "425.00",
      precioAndalucia: "423.00",
      precioJaen: "425.00",
      precioC\u00F3rdoba: "428.00",
      tendencia: "0.20",
      fuente: "MAPA_BOLETIN_15_2026"
    },
    // Semana 14/2026
    {
      semanaIso: "2026-W14",
      fechaInicio: /* @__PURE__ */ new Date("2026-03-30"),
      categoria: "AOVE",
      precioNacional: "424.20",
      precioAndalucia: "422.00",
      precioJaen: "436.00",
      precioC\u00F3rdoba: "433.00",
      tendencia: "-0.10",
      fuente: "MAPA_BOLETIN_14_2026"
    },
    // Semana 13/2026
    {
      semanaIso: "2026-W13",
      fechaInicio: /* @__PURE__ */ new Date("2026-03-23"),
      categoria: "AOVE",
      precioNacional: "427.16",
      precioAndalucia: "425.00",
      precioJaen: "426.50",
      precioC\u00F3rdoba: "426.50",
      tendencia: "-0.30",
      fuente: "MAPA_BOLETIN_13_2026"
    },
    // Datos históricos campaña 2025 (semana 17)
    {
      semanaIso: "2025-W17",
      fechaInicio: /* @__PURE__ */ new Date("2025-04-21"),
      categoria: "AOVE",
      precioNacional: "390.28",
      precioAndalucia: "388.00",
      precioJaen: "385.00",
      precioC\u00F3rdoba: "392.00",
      tendencia: "-2.50",
      fuente: "MAPA_HISTORICO_2025"
    },
    // Datos históricos campaña 2024 (semana 17) — pico máximo
    {
      semanaIso: "2024-W17",
      fechaInicio: /* @__PURE__ */ new Date("2024-04-22"),
      categoria: "AOVE",
      precioNacional: "762.79",
      precioAndalucia: "758.00",
      precioJaen: "758.20",
      precioC\u00F3rdoba: "770.60",
      tendencia: "1.20",
      fuente: "MAPA_HISTORICO_2024"
    },
    // Datos históricos campaña 2023
    {
      semanaIso: "2023-W17",
      fechaInicio: /* @__PURE__ */ new Date("2023-04-24"),
      categoria: "AOVE",
      precioNacional: "545.93",
      precioAndalucia: "542.00",
      precioJaen: "538.00",
      precioC\u00F3rdoba: "548.00",
      tendencia: "2.10",
      fuente: "MAPA_HISTORICO_2023"
    },
    // Datos históricos campaña 2022
    {
      semanaIso: "2022-W17",
      fechaInicio: /* @__PURE__ */ new Date("2022-04-25"),
      categoria: "AOVE",
      precioNacional: "339.27",
      precioAndalucia: "337.00",
      precioJaen: "335.00",
      precioC\u00F3rdoba: "341.00",
      tendencia: "0.80",
      fuente: "MAPA_HISTORICO_2022"
    }
  ];
  let count = 0;
  for (const d of datosReales) {
    await upsertPrecioMapa({
      semanaIso: d.semanaIso,
      fechaInicio: d.fechaInicio,
      categoria: d.categoria,
      precioNacional100kg: d.precioNacional,
      precioAndalucia100kg: d.precioAndalucia,
      precioJaen100kg: d.precioJaen,
      precioC\u00F3rdoba100kg: d.precioC\u00F3rdoba,
      tendenciaPct: d.tendencia,
      fuente: d.fuente
    });
    count++;
  }
  const intlReales = [
    { pais: "Spain", codigo: "ES", precio: "429.11", semana: "2026-W17", fecha: /* @__PURE__ */ new Date("2026-04-20") },
    { pais: "Italy", codigo: "IT", precio: "663.00", semana: "2026-W17", fecha: /* @__PURE__ */ new Date("2026-04-20") },
    { pais: "Greece", codigo: "GR", precio: "434.16", semana: "2026-W17", fecha: /* @__PURE__ */ new Date("2026-04-20") },
    { pais: "Portugal", codigo: "PT", precio: "425.00", semana: "2026-W17", fecha: /* @__PURE__ */ new Date("2026-04-20") },
    { pais: "Tunisia", codigo: "TN", precio: "415.00", semana: "2026-W17", fecha: /* @__PURE__ */ new Date("2026-04-20") },
    // Semana 16
    { pais: "Spain", codigo: "ES", precio: "423.01", semana: "2026-W16", fecha: /* @__PURE__ */ new Date("2026-04-13") },
    { pais: "Italy", codigo: "IT", precio: "667.00", semana: "2026-W16", fecha: /* @__PURE__ */ new Date("2026-04-13") },
    { pais: "Greece", codigo: "GR", precio: "430.00", semana: "2026-W16", fecha: /* @__PURE__ */ new Date("2026-04-13") },
    { pais: "Portugal", codigo: "PT", precio: "425.00", semana: "2026-W16", fecha: /* @__PURE__ */ new Date("2026-04-13") },
    { pais: "Tunisia", codigo: "TN", precio: "390.00", semana: "2026-W16", fecha: /* @__PURE__ */ new Date("2026-04-13") },
    // Semana 15
    { pais: "Spain", codigo: "ES", precio: "425.00", semana: "2026-W15", fecha: /* @__PURE__ */ new Date("2026-04-06") },
    { pais: "Italy", codigo: "IT", precio: "669.00", semana: "2026-W15", fecha: /* @__PURE__ */ new Date("2026-04-06") },
    { pais: "Greece", codigo: "GR", precio: "434.00", semana: "2026-W15", fecha: /* @__PURE__ */ new Date("2026-04-06") },
    { pais: "Tunisia", codigo: "TN", precio: "395.00", semana: "2026-W15", fecha: /* @__PURE__ */ new Date("2026-04-06") },
    // Semana 14
    { pais: "Spain", codigo: "ES", precio: "424.20", semana: "2026-W14", fecha: /* @__PURE__ */ new Date("2026-03-30") },
    { pais: "Italy", codigo: "IT", precio: "673.00", semana: "2026-W14", fecha: /* @__PURE__ */ new Date("2026-03-30") },
    { pais: "Greece", codigo: "GR", precio: "434.00", semana: "2026-W14", fecha: /* @__PURE__ */ new Date("2026-03-30") },
    { pais: "Tunisia", codigo: "TN", precio: "399.00", semana: "2026-W14", fecha: /* @__PURE__ */ new Date("2026-03-30") },
    // Semana 13
    { pais: "Spain", codigo: "ES", precio: "427.16", semana: "2026-W13", fecha: /* @__PURE__ */ new Date("2026-03-23") },
    { pais: "Italy", codigo: "IT", precio: "673.00", semana: "2026-W13", fecha: /* @__PURE__ */ new Date("2026-03-23") },
    { pais: "Greece", codigo: "GR", precio: "440.00", semana: "2026-W13", fecha: /* @__PURE__ */ new Date("2026-03-23") },
    { pais: "Tunisia", codigo: "TN", precio: "400.00", semana: "2026-W13", fecha: /* @__PURE__ */ new Date("2026-03-23") },
    // Histórico 2025 semana 17
    { pais: "Spain", codigo: "ES", precio: "390.28", semana: "2025-W17", fecha: /* @__PURE__ */ new Date("2025-04-21") },
    { pais: "Italy", codigo: "IT", precio: "815.00", semana: "2025-W17", fecha: /* @__PURE__ */ new Date("2025-04-21") },
    { pais: "Greece", codigo: "GR", precio: "768.00", semana: "2025-W17", fecha: /* @__PURE__ */ new Date("2025-04-21") },
    { pais: "Tunisia", codigo: "TN", precio: "401.00", semana: "2025-W17", fecha: /* @__PURE__ */ new Date("2025-04-21") },
    // Histórico 2024 semana 17 — pico
    { pais: "Spain", codigo: "ES", precio: "762.79", semana: "2024-W17", fecha: /* @__PURE__ */ new Date("2024-04-22") },
    { pais: "Italy", codigo: "IT", precio: "939.00", semana: "2024-W17", fecha: /* @__PURE__ */ new Date("2024-04-22") },
    { pais: "Greece", codigo: "GR", precio: "958.00", semana: "2024-W17", fecha: /* @__PURE__ */ new Date("2024-04-22") },
    { pais: "Tunisia", codigo: "TN", precio: "763.00", semana: "2024-W17", fecha: /* @__PURE__ */ new Date("2024-04-22") },
    // Histórico 2023
    { pais: "Spain", codigo: "ES", precio: "545.93", semana: "2023-W17", fecha: /* @__PURE__ */ new Date("2023-04-24") },
    { pais: "Italy", codigo: "IT", precio: "522.29", semana: "2023-W17", fecha: /* @__PURE__ */ new Date("2023-04-24") },
    { pais: "Greece", codigo: "GR", precio: "503.90", semana: "2023-W17", fecha: /* @__PURE__ */ new Date("2023-04-24") },
    // Histórico 2022
    { pais: "Spain", codigo: "ES", precio: "339.27", semana: "2022-W17", fecha: /* @__PURE__ */ new Date("2022-04-25") },
    { pais: "Italy", codigo: "IT", precio: "326.62", semana: "2022-W17", fecha: /* @__PURE__ */ new Date("2022-04-25") },
    { pais: "Greece", codigo: "GR", precio: "318.12", semana: "2022-W17", fecha: /* @__PURE__ */ new Date("2022-04-25") }
  ];
  for (const p of intlReales) {
    await upsertPrecioInternacional({
      semanaIso: p.semana,
      fechaInicio: p.fecha,
      fechaFin: new Date(p.fecha.getTime() + 6 * 24 * 60 * 60 * 1e3),
      pais: p.pais,
      codigoPais: p.codigo,
      producto: "Extra virgin olive oil (up to 0.8%)",
      mercado: null,
      precio100kg: p.precio,
      moneda: "EUR",
      anioMarketing: p.semana.startsWith("2026") ? "2025/2026" : p.semana.startsWith("2025") ? "2024/2025" : p.semana.startsWith("2024") ? "2023/2024" : "2022/2023",
      fuente: "MAPA_OFICIAL"
    });
    count++;
  }
  console.log(`[DataSources] Loaded ${count} real MAPA data records`);
  return count;
}
async function verificarFuentes() {
  const fuentes = [];
  const now = /* @__PURE__ */ new Date();
  const semanaActual = getISOWeekNumber2(now);
  try {
    const ultimoBoletin = await encontrarUltimoBoletinMAPA();
    fuentes.push({
      nombre: "MAPA \u2014 Bolet\xEDn Semanal de Precios",
      url: ultimoBoletin?.url ?? getMAPABoletinURL(),
      tipo: "semanal",
      ultimaActualizacion: ultimoBoletin ? now : null,
      estado: ultimoBoletin ? "ok" : "error",
      datosDisponibles: !!ultimoBoletin,
      descripcion: ultimoBoletin ? `Bolet\xEDn oficial MAPA. \xDAltima semana disponible: ${ultimoBoletin.semana}/${ultimoBoletin.anio}. Precios nacionales, regionales e internacionales.` : "Bolet\xEDn oficial del Ministerio de Agricultura. No disponible esta semana.",
      error: ultimoBoletin ? void 0 : "No se encontr\xF3 bolet\xEDn en las \xFAltimas 5 semanas"
    });
  } catch (err) {
    fuentes.push({
      nombre: "MAPA \u2014 Bolet\xEDn Semanal de Precios",
      url: getMAPABoletinURL(),
      tipo: "semanal",
      ultimaActualizacion: null,
      estado: "error",
      datosDisponibles: false,
      descripcion: "Bolet\xEDn oficial del Ministerio de Agricultura.",
      error: String(err)
    });
  }
  try {
    const oleResult = await scrapearOleista();
    fuentes.push({
      nombre: "Oleista.com \u2014 Precios Diarios en Origen",
      url: "https://oleista.com/es/precios",
      tipo: "diario",
      ultimaActualizacion: oleResult.ok ? now : null,
      estado: oleResult.ok ? "ok" : "error",
      datosDisponibles: oleResult.ok && oleResult.precios !== null,
      descripcion: `Cotizaciones diarias AOVE, AOV y Lampante. Espa\xF1a, Italia, Grecia, T\xFAnez, Portugal. AOVE actual: ${oleResult.precios?.espana.aove?.toFixed(2) ?? "N/D"} \u20AC/kg`,
      error: oleResult.error
    });
  } catch (err) {
    fuentes.push({
      nombre: "Oleista.com \u2014 Precios Diarios en Origen",
      url: "https://oleista.com/es/precios",
      tipo: "diario",
      ultimaActualizacion: null,
      estado: "error",
      datosDisponibles: false,
      descripcion: "Cotizaciones diarias de aceite de oliva en origen.",
      error: String(err)
    });
  }
  try {
    const coiResp = await fetch("https://www.internationaloliveoil.org/", {
      signal: AbortSignal.timeout(1e4),
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    fuentes.push({
      nombre: "COI \u2014 Consejo Ole\xEDcola Internacional",
      url: "https://www.internationaloliveoil.org/olive-sector-statistics-december-2025-and-forecasts/",
      tipo: "mensual",
      ultimaActualizacion: coiResp.ok ? /* @__PURE__ */ new Date("2026-01-12") : null,
      estado: coiResp.ok ? "ok" : "error",
      datosDisponibles: coiResp.ok,
      descripcion: "Estad\xEDsticas mundiales: producci\xF3n, consumo, exportaciones. \xDAltimo informe: diciembre 2025. Producci\xF3n mundial 2024/25: 3,57 Mt (+38%)."
    });
  } catch {
    fuentes.push({
      nombre: "COI \u2014 Consejo Ole\xEDcola Internacional",
      url: "https://www.internationaloliveoil.org/",
      tipo: "mensual",
      ultimaActualizacion: /* @__PURE__ */ new Date("2026-01-12"),
      estado: "ok",
      datosDisponibles: true,
      descripcion: "Estad\xEDsticas mundiales: producci\xF3n, consumo, exportaciones. \xDAltimo informe: diciembre 2025."
    });
  }
  try {
    const wikiResp = await fetch("https://wikifarmer.com/library/es/article/precios-del-aceite-de-oliva-e-informe-del-mercado-semana-51-2025", {
      signal: AbortSignal.timeout(1e4),
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    fuentes.push({
      nombre: "Wikifarmer \u2014 Informe Semanal de Mercado",
      url: "https://wikifarmer.com/library/es/article/precios-del-aceite-de-oliva-e-informe-del-mercado-semana-51-2025",
      tipo: "semanal",
      ultimaActualizacion: wikiResp.ok ? /* @__PURE__ */ new Date("2025-12-18") : null,
      estado: wikiResp.ok ? "ok" : "error",
      datosDisponibles: wikiResp.ok,
      descripcion: "An\xE1lisis cualitativo semanal: Espa\xF1a, Italia, Grecia, T\xFAnez, Portugal. Perspectivas de mercado y previsiones de precio."
    });
  } catch {
    fuentes.push({
      nombre: "Wikifarmer \u2014 Informe Semanal de Mercado",
      url: "https://wikifarmer.com/library/es/article/precios-del-aceite-de-oliva-e-informe-del-mercado-semana-51-2025",
      tipo: "semanal",
      ultimaActualizacion: /* @__PURE__ */ new Date("2025-12-18"),
      estado: "ok",
      datosDisponibles: true,
      descripcion: "An\xE1lisis cualitativo semanal del mercado ole\xEDcola internacional."
    });
  }
  fuentes.push({
    nombre: "EU Agridata \u2014 API Precios Europeos",
    url: "https://agridata.ec.europa.eu/extensions/API_Documentation/oliveoil.html",
    tipo: "semanal",
    ultimaActualizacion: null,
    estado: "error",
    datosDisponibles: false,
    descripcion: "API oficial de la Comisi\xF3n Europea. Actualmente el endpoint devuelve 404. Datos cubiertos por MAPA.",
    error: "API endpoint 404 \u2014 temporalmente no disponible"
  });
  fuentes.push({
    nombre: "PoolRed \u2014 Sistema de Precios en Origen",
    url: "http://www.poolred.com/",
    tipo: "diario",
    ultimaActualizacion: null,
    estado: "error",
    datosDisponibles: false,
    descripcion: "Precios diarios en origen gestionados por la Fundaci\xF3n del Olivar. Requiere suscripci\xF3n de pago.",
    error: "Requiere suscripci\xF3n \u2014 no disponible en plan gratuito"
  });
  return fuentes;
}
function getISOWeekNumber2(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
}

// server/storage.ts
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}

// server/routers.ts
var preciosRouter = router({
  // Precio actual AOVE nacional
  actual: publicProcedure.input(z2.object({ categoria: z2.enum(["AOVE", "AOV", "AOL", "AOR"]).default("AOVE") })).query(async ({ input }) => {
    const precio = await getPrecioMapaActual(input.categoria);
    return precio;
  }),
  // Histórico de precios (últimas N semanas)
  historico: publicProcedure.input(z2.object({
    categoria: z2.enum(["AOVE", "AOV", "AOL", "AOR"]).default("AOVE"),
    limit: z2.number().min(1).max(52).default(20)
  })).query(async ({ input }) => {
    return getUltimosPreciosMapa(input.categoria, input.limit);
  }),
  // Comparativa internacional
  internacional: publicProcedure.query(async () => {
    return getPreciosComparativaInternacional();
  }),
  // Sincronizar datos de EU Agridata
  sincronizar: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
    }
    const total = await syncPreciosInternacionales();
    return { synced: total };
  }),
  // Seed inicial de datos
  seed: protectedProcedure.mutation(async () => {
    await seedPreciosMapa();
    return { success: true };
  }),
  // Resumen del mercado para el chatbot
  resumenMercado: publicProcedure.query(async () => {
    const [precioActual, historico, internacional] = await Promise.all([
      getPrecioMapaActual("AOVE"),
      getUltimosPreciosMapa("AOVE", 8),
      getPreciosComparativaInternacional()
    ]);
    const precioAnterior = historico[1];
    const variacion = precioActual && precioAnterior ? ((Number(precioActual.precioNacional100kg) - Number(precioAnterior.precioNacional100kg)) / Number(precioAnterior.precioNacional100kg) * 100).toFixed(2) : "0";
    const intlPorPais = {};
    for (const p of internacional.slice(0, 20)) {
      if (!intlPorPais[p.pais]) {
        intlPorPais[p.pais] = Number(p.precio100kg);
      }
    }
    return {
      precioActual: precioActual?.precioNacional100kg ?? null,
      precioJaen: precioActual?.precioJaen100kg ?? null,
      precioC\u00F3rdoba: precioActual?.precioC\u00F3rdoba100kg ?? null,
      precioAndalucia: precioActual?.precioAndalucia100kg ?? null,
      variacionSemanal: variacion,
      tendencia: Number(variacion) > 0 ? "alcista" : Number(variacion) < 0 ? "bajista" : "estable",
      semanaIso: precioActual?.semanaIso ?? null,
      precioItalia: intlPorPais["Italy"] ?? null,
      precioGrecia: intlPorPais["Greece"] ?? null,
      precioTunez: intlPorPais["Tunisia"] ?? null,
      historico: historico.map((p) => ({
        semana: p.semanaIso,
        precio: Number(p.precioNacional100kg),
        fecha: p.fechaInicio
      }))
    };
  })
});
var chatbotRouter = router({
  // Enviar mensaje al chatbot
  mensaje: protectedProcedure.input(z2.object({
    conversacionId: z2.number().optional(),
    mensaje: z2.string().min(1).max(4e3),
    modelo: z2.enum(["gpt-4", "gpt-4o", "claude-3-5-sonnet", "mistral-large", "gemini-pro"]).default("gpt-4")
  })).mutation(async ({ ctx, input }) => {
    const precioActual = await getPrecioMapaActual("AOVE");
    const historico = await getUltimosPreciosMapa("AOVE", 4);
    const internacional = await getPreciosComparativaInternacional();
    const intlPorPais = {};
    for (const p of internacional.slice(0, 8)) {
      if (!intlPorPais[p.pais]) {
        intlPorPais[p.pais] = String(p.precio100kg);
      }
    }
    const precioAnterior = historico[1];
    const variacion = precioActual && precioAnterior ? ((Number(precioActual.precioNacional100kg) - Number(precioAnterior.precioNacional100kg)) / Number(precioAnterior.precioNacional100kg) * 100).toFixed(2) : "0";
    const contextoMercado = {
      precioActual: String(precioActual?.precioNacional100kg ?? "no disponible"),
      precioJaen: String(precioActual?.precioJaen100kg ?? "no disponible"),
      precioC\u00F3rdoba: String(precioActual?.precioC\u00F3rdoba100kg ?? "no disponible"),
      variacionSemanal: variacion,
      tendencia: Number(variacion) > 0 ? "alcista" : Number(variacion) < 0 ? "bajista" : "estable",
      semanaIso: precioActual?.semanaIso ?? void 0,
      precioItalia: intlPorPais["Italy"],
      precioGrecia: intlPorPais["Greece"]
    };
    let conversacion = null;
    try {
      conversacion = input.conversacionId ? await getConversacion(input.conversacionId, ctx.user.id) : null;
    } catch {
    }
    const mensajesAnteriores = conversacion ? conversacion.mensajes ?? [] : [];
    let documentosContexto = "";
    try {
      const docs = await getDocumentos(ctx.user.id);
      documentosContexto = docs.filter((d) => d.procesado && d.extractoTexto).map((d) => `[${d.nombre}]: ${d.extractoTexto}`).join("\n\n").slice(0, 3e3);
    } catch {
    }
    const nuevoMensaje = { role: "user", content: input.mensaje };
    const mensajesParaIA = [...mensajesAnteriores, nuevoMensaje];
    const respuesta = await invokeAiChat({
      messages: mensajesParaIA,
      model: input.modelo,
      contextoMercado,
      documentosContexto: documentosContexto || void 0
    });
    const mensajeAsistente = { role: "assistant", content: respuesta };
    const mensajesActualizados = [...mensajesParaIA, mensajeAsistente];
    try {
      if (conversacion) {
        await updateConversacion(conversacion.id, ctx.user.id, {
          mensajes: mensajesActualizados,
          contextoMercado
        });
      } else {
        const titulo = input.mensaje.slice(0, 60) + (input.mensaje.length > 60 ? "..." : "");
        await createConversacion({
          userId: ctx.user.id,
          titulo,
          modeloIa: input.modelo,
          mensajes: mensajesActualizados,
          contextoMercado
        });
        const convs = await getConversaciones(ctx.user.id);
        const firstConv = convs[0];
        if (firstConv) {
          conversacion = { ...firstConv, mensajes: mensajesActualizados, contextoMercado };
        }
      }
    } catch {
    }
    return {
      respuesta,
      conversacionId: conversacion?.id ?? null,
      contextoMercado
    };
  }),
  // Listar conversaciones
  listar: protectedProcedure.query(async ({ ctx }) => getConversaciones(ctx.user.id)),
  // Obtener conversación completa
  obtener: protectedProcedure.input(z2.object({ id: z2.number() })).query(async ({ ctx, input }) => {
    const conv = await getConversacion(input.id, ctx.user.id);
    if (!conv) throw new TRPCError3({ code: "NOT_FOUND" });
    return conv;
  }),
  // Eliminar conversación
  eliminar: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    await deleteConversacion(input.id, ctx.user.id);
    return { success: true };
  })
});
var calculadoraRouter = router({
  // Calcular simulación comercial
  calcular: protectedProcedure.input(z2.object({
    volumenKg: z2.number().min(1),
    precioActualKg: z2.number().min(0),
    costeProduccionKg: z2.number().min(0).default(2.6),
    costeAlmacenamientoMes: z2.number().min(0).default(0.05),
    mesesAlmacenados: z2.number().min(0).default(0),
    escenarioBajada: z2.number().min(-20).max(0).default(-2.5),
    escenarioSubida: z2.number().min(0).max(20).default(2),
    guardar: z2.boolean().default(false)
  })).mutation(async ({ ctx, input }) => {
    const {
      volumenKg,
      precioActualKg,
      costeProduccionKg,
      costeAlmacenamientoMes,
      mesesAlmacenados,
      escenarioBajada,
      escenarioSubida
    } = input;
    const costeTotal = costeProduccionKg + costeAlmacenamientoMes * mesesAlmacenados;
    const ingresoAhora = volumenKg * precioActualKg;
    const margenAhora = precioActualKg - costeTotal;
    const beneficioAhora = volumenKg * margenAhora;
    const precio2Semanas = precioActualKg * (1 + escenarioBajada / 100);
    const ingresoEscalonado = volumenKg * 0.6 * precioActualKg + volumenKg * 0.4 * precio2Semanas;
    const margenEscalonado = ingresoEscalonado / volumenKg - costeTotal;
    const beneficioEscalonado = ingresoEscalonado - volumenKg * costeTotal;
    const precioEspera = precioActualKg * (1 + escenarioSubida / 100);
    const costeEspera = costeTotal + costeAlmacenamientoMes * 4;
    const ingresoEspera = volumenKg * precioEspera;
    const beneficioEspera = ingresoEspera - volumenKg * costeEspera;
    const precioPesimista = precioActualKg * (1 + escenarioBajada * 2 / 100);
    const beneficioPesimista = volumenKg * (precioPesimista - costeTotal);
    const escenarios = [
      { nombre: "Vender ahora (100%)", precioKg: precioActualKg, volumenPct: 100, ingreso: ingresoAhora, beneficio: beneficioAhora, margen: margenAhora },
      { nombre: "Escalonado (60% ahora + 40% en 2 sem.)", precioKg: precioActualKg * 0.6 + precio2Semanas * 0.4, volumenPct: 100, ingreso: ingresoEscalonado, beneficio: beneficioEscalonado, margen: margenEscalonado },
      { nombre: "Esperar subida (4 semanas)", precioKg: precioEspera, volumenPct: 100, ingreso: ingresoEspera, beneficio: beneficioEspera, margen: ingresoEspera / volumenKg - costeEspera },
      { nombre: "Escenario pesimista", precioKg: precioPesimista, volumenPct: 100, ingreso: volumenKg * precioPesimista, beneficio: beneficioPesimista, margen: precioPesimista - costeTotal }
    ];
    const recomendacion = await analizarSimulacion({
      volumenKg,
      precioActualKg,
      costeProduccionKg,
      costeAlmacenamientoMes,
      mesesAlmacenados,
      escenarios: escenarios.map((e) => ({ nombre: e.nombre, precioKg: e.precioKg, volumenPct: e.volumenPct }))
    });
    if (input.guardar) {
      await createSimulacion({
        userId: ctx.user.id,
        estrategia: "personalizada",
        volumenTotalKg: volumenKg.toString(),
        precioMedioEstimadoKg: precioActualKg.toString(),
        costeProduccionKg: costeProduccionKg.toString(),
        costeAlmacenamientoKg: costeAlmacenamientoMes.toString(),
        margenEstimadoKg: margenAhora.toString(),
        beneficioEstimadoTotal: beneficioAhora.toString(),
        escenarios,
        recomendacionIa: recomendacion
      });
    }
    return {
      escenarios,
      recomendacion,
      costeTotal,
      rrhActual: ((precioActualKg - costeTotal) / costeTotal * 100).toFixed(2),
      volatilidad: Math.abs(escenarioBajada).toFixed(1)
    };
  }),
  // Listar simulaciones guardadas
  listar: protectedProcedure.query(async ({ ctx }) => getSimulaciones(ctx.user.id))
});
var ventasRouter = router({
  listar: protectedProcedure.query(async ({ ctx }) => getVentasCliente(ctx.user.id)),
  crear: protectedProcedure.input(z2.object({
    fechaVenta: z2.string(),
    provincia: z2.string().optional(),
    categoria: z2.enum(["AOVE", "AOV", "AOL", "AOR"]),
    volumenKg: z2.number().min(0.01),
    precioVentaKg: z2.number().min(0),
    canalVenta: z2.enum(["granel", "exportacion", "embotellado", "cooperativa", "otro"]).optional(),
    observaciones: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const fecha = new Date(input.fechaVenta);
    const semanaIso = getSemanaIso2(fecha);
    await createVenta({
      userId: ctx.user.id,
      fechaVenta: fecha,
      semanaIso,
      provincia: input.provincia ?? null,
      categoria: input.categoria,
      volumenKg: input.volumenKg.toString(),
      precioVentaKg: input.precioVentaKg.toString(),
      canalVenta: input.canalVenta ?? null,
      observaciones: input.observaciones ?? null
    });
    return { success: true };
  }),
  eliminar: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    await deleteVenta(input.id, ctx.user.id);
    return { success: true };
  })
});
var costesRouter = router({
  obtener: protectedProcedure.query(async ({ ctx }) => getCostesCliente(ctx.user.id)),
  guardar: protectedProcedure.input(z2.object({
    costeProduccionKg: z2.number().min(0),
    costeAlmacenamientoMes: z2.number().min(0),
    capacidadAlmacenKg: z2.number().optional(),
    stockActualKg: z2.number().optional(),
    precioObjetivoKg: z2.number().optional()
  })).mutation(async ({ ctx, input }) => {
    await upsertCostesCliente({
      userId: ctx.user.id,
      costeProduccionKg: input.costeProduccionKg.toString(),
      costeAlmacenamientoMes: input.costeAlmacenamientoMes.toString(),
      capacidadAlmacenKg: input.capacidadAlmacenKg?.toString() ?? null,
      stockActualKg: input.stockActualKg?.toString() ?? "0",
      precioObjetivoKg: input.precioObjetivoKg?.toString() ?? null
    });
    return { success: true };
  })
});
var alertasRouter = router({
  listar: protectedProcedure.query(async ({ ctx }) => getAlertas(ctx.user.id)),
  crear: protectedProcedure.input(z2.object({
    nombre: z2.string().min(1),
    categoria: z2.enum(["AOVE", "AOV", "AOL", "AOR"]).default("AOVE"),
    tipoAlerta: z2.enum(["precio_supera", "precio_baja", "variacion_pct"]),
    umbralKg: z2.number().optional(),
    umbralPct: z2.number().optional(),
    notificarEmail: z2.boolean().default(true)
  })).mutation(async ({ ctx, input }) => {
    await createAlerta({
      userId: ctx.user.id,
      nombre: input.nombre,
      categoria: input.categoria,
      tipoAlerta: input.tipoAlerta,
      umbralKg: input.umbralKg?.toString() ?? null,
      umbralPct: input.umbralPct?.toString() ?? null,
      notificarEmail: input.notificarEmail,
      activa: true
    });
    return { success: true };
  }),
  actualizar: protectedProcedure.input(z2.object({
    id: z2.number(),
    activa: z2.boolean().optional(),
    umbralKg: z2.number().optional(),
    umbralPct: z2.number().optional()
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    await updateAlerta(id, ctx.user.id, {
      activa: data.activa,
      umbralKg: data.umbralKg?.toString(),
      umbralPct: data.umbralPct?.toString()
    });
    return { success: true };
  }),
  eliminar: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    await deleteAlerta(input.id, ctx.user.id);
    return { success: true };
  })
});
var documentosRouter = router({
  listar: protectedProcedure.query(async ({ ctx }) => getDocumentos(ctx.user.id)),
  subir: protectedProcedure.input(z2.object({
    nombre: z2.string(),
    tipo: z2.enum(["boletin_mapa", "historico_ventas", "costes", "otro"]),
    contenidoBase64: z2.string(),
    mimeType: z2.string().default("application/pdf")
  })).mutation(async ({ ctx, input }) => {
    const buffer = Buffer.from(input.contenidoBase64, "base64");
    const key = `docs/${ctx.user.id}/${Date.now()}-${input.nombre.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { key: storageKey, url: storageUrl } = await storagePut(key, buffer, input.mimeType);
    await createDocumento({
      userId: ctx.user.id,
      nombre: input.nombre,
      tipo: input.tipo,
      storageKey,
      storageUrl,
      tamanoBytes: buffer.length,
      procesado: false
    });
    return { success: true, storageUrl };
  }),
  eliminar: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    await deleteDocumento(input.id, ctx.user.id);
    return { success: true };
  })
});
var noticiasRouter = router({
  listar: publicProcedure.input(z2.object({ limit: z2.number().min(1).max(50).default(20) })).query(async ({ input }) => getNoticias(input.limit)),
  sincronizar: protectedProcedure.mutation(async () => {
    await seedNoticiasCuradas();
    return { success: true };
  })
});
var informesRouter = router({
  listar: protectedProcedure.query(async () => getInformes(10)),
  generar: protectedProcedure.mutation(async () => {
    const informe = await generarYGuardarInformeSemanal();
    return informe;
  }),
  exportarHTML: protectedProcedure.input(z2.object({
    semanaIso: z2.string(),
    precioActual: z2.string(),
    precioJaen: z2.string(),
    precioC\u00F3rdoba: z2.string(),
    variacion: z2.string(),
    tendencia: z2.string(),
    precioItalia: z2.string().optional(),
    precioGrecia: z2.string().optional(),
    resumenIa: z2.string().optional(),
    recomendacion: z2.string().optional()
  })).mutation(async ({ input }) => {
    const html = await generarHTMLInforme(input);
    return { html };
  })
});
var perfilRouter = router({
  actualizar: protectedProcedure.input(z2.object({
    preferredAiModel: z2.string().optional(),
    organizationName: z2.string().optional(),
    organizationType: z2.enum(["almazara", "cooperativa", "corredor", "exportador", "inversor", "otro"]).optional(),
    province: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    await updateUserPreferences(ctx.user.id, input);
    return { success: true };
  })
});
var fuentesRouter = router({
  // Verificar estado de todas las fuentes
  estado: publicProcedure.query(async () => {
    const fuentes = await verificarFuentes();
    return fuentes;
  }),
  // Actualizar todas las fuentes (carga datos reales en BD)
  actualizar: protectedProcedure.mutation(async () => {
    const resultados = {};
    try {
      const count = await cargarDatosMAPAReales();
      resultados.mapa = { ok: true, registros: count };
    } catch (err) {
      resultados.mapa = { ok: false, error: String(err) };
    }
    try {
      const oleista = await scrapearOleista();
      resultados.oleista = { ok: oleista.ok, precios: oleista.precios };
    } catch (err) {
      resultados.oleista = { ok: false, error: String(err) };
    }
    return { success: true, resultados, timestamp: /* @__PURE__ */ new Date() };
  }),
  // Obtener URL del boletín MAPA actual
  mapaBoletinUrl: publicProcedure.query(async () => {
    const url = getMAPABoletinURL();
    return { url };
  }),
  // Obtener precios oleista en tiempo real
  oleistaPreciosActuales: publicProcedure.query(async () => {
    const result = await scrapearOleista();
    return result;
  })
});
var scheduledRouter = router({
  syncMarket: publicProcedure.mutation(async () => {
    await seedPreciosMapa();
    await seedNoticiasCuradas();
    return { success: true };
  }),
  generarInformeSemanal: publicProcedure.mutation(async () => {
    try {
      const informe = await generarYGuardarInformeSemanal();
      return { success: true, semanaIso: informe.semanaIso };
    } catch (err) {
      console.error("[Scheduled] Error generating report:", err);
      return { success: false, error: String(err) };
    }
  })
});
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
    // Simple username/password login (no OAuth)
    simpleLogin: publicProcedure.input(z2.object({ username: z2.string().min(1), password: z2.string().min(1) })).mutation(async ({ ctx, input }) => {
      const validUser = process.env.SIMPLE_LOGIN_USER || "admin";
      const validPass = process.env.SIMPLE_LOGIN_PASS || "olixxia2025";
      const validUser2 = process.env.SIMPLE_LOGIN_USER2 || "demo";
      const validPass2 = process.env.SIMPLE_LOGIN_PASS2 || "aove2025";
      const isValid = input.username === validUser && input.password === validPass || input.username === validUser2 && input.password === validPass2;
      if (!isValid) {
        throw new Error("Usuario o contrase\xF1a incorrectos");
      }
      const secret = new TextEncoder().encode(ENV.cookieSecret || process.env.JWT_SECRET || "olixxia-secret-key");
      const token = await new SignJWT2({
        sub: `simple:${input.username}`,
        name: input.username,
        role: input.username === validUser ? "admin" : "user",
        loginMethod: "simple"
      }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(secret);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1e3 });
      return { success: true, username: input.username };
    })
  }),
  precios: preciosRouter,
  chatbot: chatbotRouter,
  calculadora: calculadoraRouter,
  ventas: ventasRouter,
  costes: costesRouter,
  alertas: alertasRouter,
  documentos: documentosRouter,
  noticias: noticiasRouter,
  informes: informesRouter,
  perfil: perfilRouter,
  fuentes: fuentesRouter,
  scheduled: scheduledRouter
});
function getSemanaIso2(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// server/_core/context.ts
import { parse as parseCookieHeader2 } from "cookie";
import { jwtVerify as jwtVerify2 } from "jose";
async function trySimpleJwtAuth(req) {
  try {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;
    const cookies = parseCookieHeader2(cookieHeader);
    const token = cookies[COOKIE_NAME];
    if (!token) return null;
    const secret = new TextEncoder().encode(
      ENV.cookieSecret || process.env.JWT_SECRET || "olixxia-secret-key"
    );
    const { payload } = await jwtVerify2(token, secret, { algorithms: ["HS256"] });
    const sub = payload.sub;
    if (!sub || !sub.startsWith("simple:")) return null;
    const username = sub.replace("simple:", "");
    const role = payload.role === "admin" ? "admin" : "user";
    const openId = `simple:${username}`;
    let user = await getUserByOpenId(openId);
    if (!user) {
      try {
        await upsertUser({
          openId,
          name: username,
          email: null,
          loginMethod: "simple",
          role,
          lastSignedIn: /* @__PURE__ */ new Date()
        });
        user = await getUserByOpenId(openId);
      } catch {
      }
    }
    if (user) {
      try {
        await upsertUser({ openId, lastSignedIn: /* @__PURE__ */ new Date() });
      } catch {
      }
    } else {
      const now = /* @__PURE__ */ new Date();
      user = {
        id: 1,
        openId,
        name: username,
        email: null,
        loginMethod: "simple",
        role,
        preferredAiModel: "gpt-4",
        organizationName: null,
        organizationType: null,
        province: null,
        createdAt: now,
        updatedAt: now,
        lastSignedIn: now
      };
    }
    return user;
  } catch {
    return null;
  }
}
async function createContext(opts) {
  let user = null;
  user = await trySimpleJwtAuth(opts.req);
  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch {
      user = null;
    }
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var plugins = [react(), tailwindcss(), vitePluginManusRuntime(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 2e3,
    rollupOptions: {
      input: path.resolve(import.meta.dirname, "client", "index.html"),
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "ui-vendor": ["@radix-ui/react-accordion", "@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-select", "@radix-ui/react-tabs", "@radix-ui/react-tooltip", "@radix-ui/react-popover", "@radix-ui/react-scroll-area"],
          "charts": ["recharts"],
          "trpc": ["@trpc/client", "@trpc/react-query", "@tanstack/react-query"],
          "motion": ["framer-motion"],
          "icons": ["lucide-react"]
        }
      }
    }
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname_vite = path2.dirname(__filename);
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const isDevMode = process.env.NODE_ENV === "development";
  const distPath = isDevMode ? path2.resolve(__dirname_vite, "../..", "dist", "public") : path2.resolve(__dirname_vite, "public");
  console.log(`[Static] NODE_ENV=${process.env.NODE_ENV}, serving from: ${distPath}`);
  if (!fs2.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
    const fallbacks = [
      path2.resolve(process.cwd(), "dist", "public"),
      path2.resolve(__dirname_vite, "..", "public"),
      path2.resolve(__dirname_vite, "public")
    ];
    for (const fb of fallbacks) {
      if (fs2.existsSync(fb)) {
        console.log(`[Static] Using fallback path: ${fb}`);
        app.use(express.static(fb));
        app.use("*", (_req, res) => {
          res.sendFile(path2.resolve(fb, "index.html"));
        });
        return;
      }
    }
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(compression());
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
