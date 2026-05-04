import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { SignJWT } from "jose";
import { ENV } from "./_core/env";
import {
  createAlerta,
  createConversacion,
  createDocumento,
  createSimulacion,
  createVenta,
  deleteAlerta,
  deleteConversacion,
  deleteDocumento,
  deleteVenta,
  getAlertas,
  getConversacion,
  getConversaciones,
  getCostesCliente,
  getDocumentos,
  getInformes,
  getNoticias,
  getPrecioMapaActual,
  getPreciosComparativaInternacional,
  getPreciosInternacionalesRecientes,
  getSimulaciones,
  getUltimosPreciosMapa,
  getVentasCliente,
  updateAlerta,
  updateConversacion,
  updateDocumentoExtracto,
  updateUserPreferences,
  upsertCostesCliente,
} from "./db";
import { analizarSimulacion, invokeAiChat, type AiModel, type ChatMessage, type MarketContext } from "./aiEngine";
import { generarYGuardarInformeSemanal, generarHTMLInforme } from "./reportService";
import { seedNoticiasCuradas, syncNoticias } from "./newsService";
import { seedPreciosMapa, syncPreciosInternacionales } from "./marketData";
import { cargarDatosMAPAReales, verificarFuentes, scrapearOleista, getMAPABoletinURL } from "./dataSourcesService";
import { storagePut } from "./storage";

// ─── Precios Router ───────────────────────────────────────────────────────────
const preciosRouter = router({
  // Precio actual AOVE nacional
  actual: publicProcedure
    .input(z.object({ categoria: z.enum(["AOVE", "AOV", "AOL", "AOR"]).default("AOVE") }))
    .query(async ({ input }) => {
      const precio = await getPrecioMapaActual(input.categoria);
      return precio;
    }),

  // Histórico de precios (últimas N semanas)
  historico: publicProcedure
    .input(z.object({
      categoria: z.enum(["AOVE", "AOV", "AOL", "AOR"]).default("AOVE"),
      limit: z.number().min(1).max(52).default(20),
    }))
    .query(async ({ input }) => {
      return getUltimosPreciosMapa(input.categoria, input.limit);
    }),

  // Comparativa internacional
  internacional: publicProcedure
    .query(async () => {
      return getPreciosComparativaInternacional();
    }),

  // Sincronizar datos de EU Agridata
  sincronizar: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        // Cualquier usuario puede sincronizar (útil para actualizar datos)
      }
      const total = await syncPreciosInternacionales();
      return { synced: total };
    }),

  // Seed inicial de datos
  seed: protectedProcedure
    .mutation(async () => {
      await seedPreciosMapa();
      return { success: true };
    }),

  // Resumen del mercado para el chatbot
  resumenMercado: publicProcedure
    .query(async () => {
      const [precioActual, historico, internacional] = await Promise.all([
        getPrecioMapaActual("AOVE"),
        getUltimosPreciosMapa("AOVE", 8),
        getPreciosComparativaInternacional(),
      ]);

      const precioAnterior = historico[1];
      const variacion = precioActual && precioAnterior
        ? (((Number(precioActual.precioNacional100kg) - Number(precioAnterior.precioNacional100kg)) / Number(precioAnterior.precioNacional100kg)) * 100).toFixed(2)
        : "0";

      const intlPorPais: Record<string, number> = {};
      for (const p of internacional.slice(0, 20)) {
        if (!intlPorPais[p.pais]) {
          intlPorPais[p.pais] = Number(p.precio100kg);
        }
      }

      return {
        precioActual: precioActual?.precioNacional100kg ?? null,
        precioJaen: precioActual?.precioJaen100kg ?? null,
        precioCórdoba: precioActual?.precioCórdoba100kg ?? null,
        precioAndalucia: precioActual?.precioAndalucia100kg ?? null,
        variacionSemanal: variacion,
        tendencia: Number(variacion) > 0 ? "alcista" : Number(variacion) < 0 ? "bajista" : "estable",
        semanaIso: precioActual?.semanaIso ?? null,
        precioItalia: intlPorPais["Italy"] ?? null,
        precioGrecia: intlPorPais["Greece"] ?? null,
        precioTunez: intlPorPais["Tunisia"] ?? null,
        historico: historico.map(p => ({
          semana: p.semanaIso,
          precio: Number(p.precioNacional100kg),
          fecha: p.fechaInicio,
        })),
      };
    }),
});

// ─── Chatbot Router ───────────────────────────────────────────────────────────
const chatbotRouter = router({
  // Enviar mensaje al chatbot
  mensaje: protectedProcedure
    .input(z.object({
      conversacionId: z.number().optional(),
      mensaje: z.string().min(1).max(4000),
      modelo: z.enum(["gpt-4", "gpt-4o", "claude-3-5-sonnet", "mistral-large", "gemini-pro"]).default("gpt-4"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Obtener contexto de mercado actual
      const precioActual = await getPrecioMapaActual("AOVE");
      const historico = await getUltimosPreciosMapa("AOVE", 4);
      const internacional = await getPreciosComparativaInternacional();

      const intlPorPais: Record<string, string> = {};
      for (const p of internacional.slice(0, 8)) {
        if (!intlPorPais[p.pais]) {
          intlPorPais[p.pais] = String(p.precio100kg);
        }
      }

      const precioAnterior = historico[1];
      const variacion = precioActual && precioAnterior
        ? (((Number(precioActual.precioNacional100kg) - Number(precioAnterior.precioNacional100kg)) / Number(precioAnterior.precioNacional100kg)) * 100).toFixed(2)
        : "0";

      const contextoMercado: MarketContext = {
        precioActual: String(precioActual?.precioNacional100kg ?? "no disponible"),
        precioJaen: String(precioActual?.precioJaen100kg ?? "no disponible"),
        precioCórdoba: String(precioActual?.precioCórdoba100kg ?? "no disponible"),
        variacionSemanal: variacion,
        tendencia: Number(variacion) > 0 ? "alcista" : Number(variacion) < 0 ? "bajista" : "estable",
        semanaIso: precioActual?.semanaIso ?? undefined,
        precioItalia: intlPorPais["Italy"],
        precioGrecia: intlPorPais["Greece"],
      };

      // Obtener o crear conversación (graceful degradation sin BD)
      let conversacion = null;
      try {
        conversacion = input.conversacionId
          ? await getConversacion(input.conversacionId, ctx.user.id)
          : null;
      } catch { /* BD no disponible */ }

      const mensajesAnteriores: ChatMessage[] = conversacion
        ? (conversacion.mensajes as ChatMessage[]) ?? []
        : [];

      // Obtener contexto de documentos del usuario
      let documentosContexto = "";
      try {
        const docs = await getDocumentos(ctx.user.id);
        documentosContexto = docs
          .filter(d => d.procesado && d.extractoTexto)
          .map(d => `[${d.nombre}]: ${d.extractoTexto}`)
          .join("\n\n")
          .slice(0, 3000);
      } catch { /* BD no disponible */ }

      // Agregar mensaje del usuario
      const nuevoMensaje: ChatMessage = { role: "user", content: input.mensaje };
      const mensajesParaIA = [...mensajesAnteriores, nuevoMensaje];

      // Invocar IA
      const respuesta = await invokeAiChat({
        messages: mensajesParaIA,
        model: input.modelo as AiModel,
        contextoMercado,
        documentosContexto: documentosContexto || undefined,
      });

      const mensajeAsistente: ChatMessage = { role: "assistant", content: respuesta };
      const mensajesActualizados = [...mensajesParaIA, mensajeAsistente];

      // Guardar conversación (graceful degradation sin BD)
      try {
        if (conversacion) {
          await updateConversacion(conversacion.id, ctx.user.id, {
            mensajes: mensajesActualizados,
            contextoMercado,
          });
        } else {
          const titulo = input.mensaje.slice(0, 60) + (input.mensaje.length > 60 ? "..." : "");
          await createConversacion({
            userId: ctx.user.id,
            titulo,
            modeloIa: input.modelo,
            mensajes: mensajesActualizados,
            contextoMercado,
          });
          const convs = await getConversaciones(ctx.user.id);
          const firstConv = convs[0];
          if (firstConv) {
            conversacion = { ...firstConv, mensajes: mensajesActualizados, contextoMercado } as unknown as typeof conversacion;
          }
        }
      } catch { /* BD no disponible, continuar sin persistir */ }

      return {
        respuesta,
        conversacionId: conversacion?.id ?? null,
        contextoMercado,
      };
    }),

  // Listar conversaciones
  listar: protectedProcedure
    .query(async ({ ctx }) => getConversaciones(ctx.user.id)),

  // Obtener conversación completa
  obtener: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const conv = await getConversacion(input.id, ctx.user.id);
      if (!conv) throw new TRPCError({ code: "NOT_FOUND" });
      return conv;
    }),

  // Eliminar conversación
  eliminar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteConversacion(input.id, ctx.user.id);
      return { success: true };
    }),
});

// ─── Calculadora / Simulaciones Router ───────────────────────────────────────
const calculadoraRouter = router({
  // Calcular simulación comercial
  calcular: protectedProcedure
    .input(z.object({
      volumenKg: z.number().min(1),
      precioActualKg: z.number().min(0),
      costeProduccionKg: z.number().min(0).default(2.60),
      costeAlmacenamientoMes: z.number().min(0).default(0.05),
      mesesAlmacenados: z.number().min(0).default(0),
      escenarioBajada: z.number().min(-20).max(0).default(-2.5),
      escenarioSubida: z.number().min(0).max(20).default(2.0),
      guardar: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const {
        volumenKg, precioActualKg, costeProduccionKg,
        costeAlmacenamientoMes, mesesAlmacenados,
        escenarioBajada, escenarioSubida,
      } = input;

      const costeTotal = costeProduccionKg + (costeAlmacenamientoMes * mesesAlmacenados);

      // Escenario 1: Vender todo ahora
      const ingresoAhora = volumenKg * precioActualKg;
      const margenAhora = precioActualKg - costeTotal;
      const beneficioAhora = volumenKg * margenAhora;

      // Escenario 2: Vender escalonado (60% ahora, 40% en 2 semanas)
      const precio2Semanas = precioActualKg * (1 + escenarioBajada / 100);
      const ingresoEscalonado = (volumenKg * 0.6 * precioActualKg) + (volumenKg * 0.4 * precio2Semanas);
      const margenEscalonado = ingresoEscalonado / volumenKg - costeTotal;
      const beneficioEscalonado = ingresoEscalonado - (volumenKg * costeTotal);

      // Escenario 3: Esperar subida
      const precioEspera = precioActualKg * (1 + escenarioSubida / 100);
      const costeEspera = costeTotal + (costeAlmacenamientoMes * 4); // 4 semanas más
      const ingresoEspera = volumenKg * precioEspera;
      const beneficioEspera = ingresoEspera - (volumenKg * costeEspera);

      // Escenario 4: Escenario pesimista (bajada máxima)
      const precioPesimista = precioActualKg * (1 + escenarioBajada * 2 / 100);
      const beneficioPesimista = volumenKg * (precioPesimista - costeTotal);

      const escenarios = [
        { nombre: "Vender ahora (100%)", precioKg: precioActualKg, volumenPct: 100, ingreso: ingresoAhora, beneficio: beneficioAhora, margen: margenAhora },
        { nombre: "Escalonado (60% ahora + 40% en 2 sem.)", precioKg: (precioActualKg * 0.6 + precio2Semanas * 0.4), volumenPct: 100, ingreso: ingresoEscalonado, beneficio: beneficioEscalonado, margen: margenEscalonado },
        { nombre: "Esperar subida (4 semanas)", precioKg: precioEspera, volumenPct: 100, ingreso: ingresoEspera, beneficio: beneficioEspera, margen: ingresoEspera / volumenKg - costeEspera },
        { nombre: "Escenario pesimista", precioKg: precioPesimista, volumenPct: 100, ingreso: volumenKg * precioPesimista, beneficio: beneficioPesimista, margen: precioPesimista - costeTotal },
      ];

      // Recomendación IA
      const recomendacion = await analizarSimulacion({
        volumenKg,
        precioActualKg,
        costeProduccionKg,
        costeAlmacenamientoMes,
        mesesAlmacenados,
        escenarios: escenarios.map(e => ({ nombre: e.nombre, precioKg: e.precioKg, volumenPct: e.volumenPct })),
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
          recomendacionIa: recomendacion,
        });
      }

      return {
        escenarios,
        recomendacion,
        costeTotal,
        rrhActual: ((precioActualKg - costeTotal) / costeTotal * 100).toFixed(2),
        volatilidad: Math.abs(escenarioBajada).toFixed(1),
      };
    }),

  // Listar simulaciones guardadas
  listar: protectedProcedure
    .query(async ({ ctx }) => getSimulaciones(ctx.user.id)),
});

// ─── Ventas Router ────────────────────────────────────────────────────────────
const ventasRouter = router({
  listar: protectedProcedure
    .query(async ({ ctx }) => getVentasCliente(ctx.user.id)),

  crear: protectedProcedure
    .input(z.object({
      fechaVenta: z.string(),
      provincia: z.string().optional(),
      categoria: z.enum(["AOVE", "AOV", "AOL", "AOR"]),
      volumenKg: z.number().min(0.01),
      precioVentaKg: z.number().min(0),
      canalVenta: z.enum(["granel", "exportacion", "embotellado", "cooperativa", "otro"]).optional(),
      observaciones: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const fecha = new Date(input.fechaVenta);
      const semanaIso = getSemanaIso(fecha);
      await createVenta({
        userId: ctx.user.id,
        fechaVenta: fecha,
        semanaIso,
        provincia: input.provincia ?? null,
        categoria: input.categoria,
        volumenKg: input.volumenKg.toString(),
        precioVentaKg: input.precioVentaKg.toString(),
        canalVenta: input.canalVenta ?? null,
        observaciones: input.observaciones ?? null,
      });
      return { success: true };
    }),

  eliminar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteVenta(input.id, ctx.user.id);
      return { success: true };
    }),
});

// ─── Costes Router ────────────────────────────────────────────────────────────
const costesRouter = router({
  obtener: protectedProcedure
    .query(async ({ ctx }) => getCostesCliente(ctx.user.id)),

  guardar: protectedProcedure
    .input(z.object({
      costeProduccionKg: z.number().min(0),
      costeAlmacenamientoMes: z.number().min(0),
      capacidadAlmacenKg: z.number().optional(),
      stockActualKg: z.number().optional(),
      precioObjetivoKg: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await upsertCostesCliente({
        userId: ctx.user.id,
        costeProduccionKg: input.costeProduccionKg.toString(),
        costeAlmacenamientoMes: input.costeAlmacenamientoMes.toString(),
        capacidadAlmacenKg: input.capacidadAlmacenKg?.toString() ?? null,
        stockActualKg: input.stockActualKg?.toString() ?? "0",
        precioObjetivoKg: input.precioObjetivoKg?.toString() ?? null,
      });
      return { success: true };
    }),
});

// ─── Alertas Router ───────────────────────────────────────────────────────────
const alertasRouter = router({
  listar: protectedProcedure
    .query(async ({ ctx }) => getAlertas(ctx.user.id)),

  crear: protectedProcedure
    .input(z.object({
      nombre: z.string().min(1),
      categoria: z.enum(["AOVE", "AOV", "AOL", "AOR"]).default("AOVE"),
      tipoAlerta: z.enum(["precio_supera", "precio_baja", "variacion_pct"]),
      umbralKg: z.number().optional(),
      umbralPct: z.number().optional(),
      notificarEmail: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      await createAlerta({
        userId: ctx.user.id,
        nombre: input.nombre,
        categoria: input.categoria,
        tipoAlerta: input.tipoAlerta,
        umbralKg: input.umbralKg?.toString() ?? null,
        umbralPct: input.umbralPct?.toString() ?? null,
        notificarEmail: input.notificarEmail,
        activa: true,
      });
      return { success: true };
    }),

  actualizar: protectedProcedure
    .input(z.object({
      id: z.number(),
      activa: z.boolean().optional(),
      umbralKg: z.number().optional(),
      umbralPct: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await updateAlerta(id, ctx.user.id, {
        activa: data.activa,
        umbralKg: data.umbralKg?.toString(),
        umbralPct: data.umbralPct?.toString(),
      });
      return { success: true };
    }),

  eliminar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteAlerta(input.id, ctx.user.id);
      return { success: true };
    }),
});

// ─── Documentos Router ────────────────────────────────────────────────────────
const documentosRouter = router({
  listar: protectedProcedure
    .query(async ({ ctx }) => getDocumentos(ctx.user.id)),

  subir: protectedProcedure
    .input(z.object({
      nombre: z.string(),
      tipo: z.enum(["boletin_mapa", "historico_ventas", "costes", "otro"]),
      contenidoBase64: z.string(),
      mimeType: z.string().default("application/pdf"),
    }))
    .mutation(async ({ ctx, input }) => {
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
        procesado: false,
      });

      return { success: true, storageUrl };
    }),

  eliminar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteDocumento(input.id, ctx.user.id);
      return { success: true };
    }),
});

// ─── Noticias Router ──────────────────────────────────────────────────────────
const noticiasRouter = router({
  listar: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ input }) => getNoticias(input.limit)),

  sincronizar: protectedProcedure
    .mutation(async () => {
      await seedNoticiasCuradas();
      return { success: true };
    }),
});

// ─── Informes Router ──────────────────────────────────────────────────────────
const informesRouter = router({
  listar: protectedProcedure
    .query(async () => getInformes(10)),

  generar: protectedProcedure
    .mutation(async () => {
      const informe = await generarYGuardarInformeSemanal();
      return informe;
    }),

  exportarHTML: protectedProcedure
    .input(z.object({
      semanaIso: z.string(),
      precioActual: z.string(),
      precioJaen: z.string(),
      precioCórdoba: z.string(),
      variacion: z.string(),
      tendencia: z.string(),
      precioItalia: z.string().optional(),
      precioGrecia: z.string().optional(),
      resumenIa: z.string().optional(),
      recomendacion: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const html = await generarHTMLInforme(input);
      return { html };
    }),
});

// ─── Perfil Router ────────────────────────────────────────────────────────────
const perfilRouter = router({
  actualizar: protectedProcedure
    .input(z.object({
      preferredAiModel: z.string().optional(),
      organizationName: z.string().optional(),
      organizationType: z.enum(["almazara", "cooperativa", "corredor", "exportador", "inversor", "otro"]).optional(),
      province: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await updateUserPreferences(ctx.user.id, input);
      return { success: true };
    }),
});

// ─── Fuentes Router ──────────────────────────────────────────────────────────
const fuentesRouter = router({
  // Verificar estado de todas las fuentes
  estado: publicProcedure
    .query(async () => {
      const fuentes = await verificarFuentes();
      return fuentes;
    }),

  // Actualizar todas las fuentes (carga datos reales en BD)
  actualizar: protectedProcedure
    .mutation(async () => {
      const resultados: Record<string, unknown> = {};

      // 1. Cargar datos reales MAPA
      try {
        const count = await cargarDatosMAPAReales();
        resultados.mapa = { ok: true, registros: count };
      } catch (err) {
        resultados.mapa = { ok: false, error: String(err) };
      }

      // 2. Obtener precios oleista
      try {
        const oleista = await scrapearOleista();
        resultados.oleista = { ok: oleista.ok, precios: oleista.precios };
      } catch (err) {
        resultados.oleista = { ok: false, error: String(err) };
      }

      return { success: true, resultados, timestamp: new Date() };
    }),

  // Obtener URL del boletín MAPA actual
  mapaBoletinUrl: publicProcedure
    .query(async () => {
      const url = getMAPABoletinURL();
      return { url };
    }),

  // Obtener precios oleista en tiempo real
  oleistaPreciosActuales: publicProcedure
    .query(async () => {
      const result = await scrapearOleista();
      return result;
    }),
});

// ─── Scheduled endpoint ───────────────────────────────────────────────────────────────
const scheduledRouter = router({
  syncMarket: publicProcedure
    .mutation(async () => {
      await seedPreciosMapa();
      await seedNoticiasCuradas();
      return { success: true };
    }),

  generarInformeSemanal: publicProcedure
    .mutation(async () => {
      try {
        const informe = await generarYGuardarInformeSemanal();
        return { success: true, semanaIso: informe.semanaIso };
      } catch (err) {
        console.error("[Scheduled] Error generating report:", err);
        return { success: false, error: String(err) };
      }
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    // Simple username/password login (no OAuth)
    simpleLogin: publicProcedure
      .input(z.object({ username: z.string().min(1), password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        // Credentials — change these via env vars SIMPLE_LOGIN_USER / SIMPLE_LOGIN_PASS
        const validUser = process.env.SIMPLE_LOGIN_USER || "admin";
        const validPass = process.env.SIMPLE_LOGIN_PASS || "olixxia2025";
        const validUser2 = process.env.SIMPLE_LOGIN_USER2 || "demo";
        const validPass2 = process.env.SIMPLE_LOGIN_PASS2 || "aove2025";

        const isValid =
          (input.username === validUser && input.password === validPass) ||
          (input.username === validUser2 && input.password === validPass2);

        if (!isValid) {
          throw new Error("Usuario o contraseña incorrectos");
        }

        // Create a simple JWT session
        const secret = new TextEncoder().encode(ENV.cookieSecret || process.env.JWT_SECRET || "olixxia-secret-key");
        const token = await new SignJWT({
          sub: `simple:${input.username}`,
          name: input.username,
          role: input.username === validUser ? "admin" : "user",
          loginMethod: "simple",
        })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("30d")
          .sign(secret);

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });

        return { success: true, username: input.username };
      }),
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
  scheduled: scheduledRouter,
});

export type AppRouter = typeof appRouter;

// ─── Helper ───────────────────────────────────────────────────────────────────
function getSemanaIso(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
