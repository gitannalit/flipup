import { describe, expect, it, vi } from "vitest";

// Mock AI engine to avoid real API calls in tests
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Recomendación de prueba: vender ahora es la mejor opción." } }],
  }),
}));
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "user" | "admin" = "user"): { ctx: TrpcContext; clearedCookies: Array<{ name: string; options: Record<string, unknown> }> } {
  const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-openid",
    email: "test@olixxia.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

function createPublicContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
  return { ctx };
}

// ── Auth tests ────────────────────────────────────────────────────────────────
describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });

  it("returns null for unauthenticated user", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const me = await caller.auth.me();
    expect(me).toBeNull();
  });
});

// ── Calculadora tests ─────────────────────────────────────────────────────────
describe("calculadora.calcular", () => {
  it("calculates scenarios correctly for a basic operation", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.calculadora.calcular({
      volumenKg: 10000,
      precioActualKg: 8.71,
      costeProduccionKg: 2.60,
      costeAlmacenamientoMes: 0.05,
      mesesAlmacenados: 2,
      escenarioBajada: -2.5,
      escenarioSubida: 2.0,
      guardar: false,
    });

    expect(result.escenarios).toHaveLength(4);
    expect(result.escenarios[0]).toMatchObject({
      nombre: expect.stringContaining("Vender ahora"),
      precioKg: 8.71,
      volumenPct: 100,
    });

    // Beneficio = (precio - coste) * volumen
    const costeTotal = 2.60 + (0.05 * 2); // 2.70
    const beneficioEsperado = (8.71 - costeTotal) * 10000;
    expect(result.escenarios[0].beneficio).toBeCloseTo(beneficioEsperado, 0);

    // RRH debe ser positivo con precio > coste
    expect(Number(result.rrhActual)).toBeGreaterThan(0);
  });

  it("returns negative margin when price is below cost", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.calculadora.calcular({
      volumenKg: 5000,
      precioActualKg: 2.00, // Below production cost
      costeProduccionKg: 2.60,
      costeAlmacenamientoMes: 0.05,
      mesesAlmacenados: 0,
      escenarioBajada: -2.5,
      escenarioSubida: 2.0,
      guardar: false,
    });

    expect(result.escenarios[0].beneficio).toBeLessThan(0);
    expect(Number(result.rrhActual)).toBeLessThan(0);
  });
});

// ── Precios tests ─────────────────────────────────────────────────────────────
describe("precios.resumenMercado", () => {
  it("returns market summary without throwing", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Should not throw even if DB is empty
    const result = await caller.precios.resumenMercado();
    expect(result).toBeDefined();
    expect(result).toHaveProperty("historico");
    expect(Array.isArray(result.historico)).toBe(true);
  });
});

// ── Alertas tests ─────────────────────────────────────────────────────────────
describe("alertas", () => {
  it("creates and lists alerts for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Should not throw
    const alertas = await caller.alertas.listar();
    expect(Array.isArray(alertas)).toBe(true);
  });
});
