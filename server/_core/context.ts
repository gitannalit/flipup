import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { parse as parseCookieHeader } from "cookie";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "@shared/const";
import { ENV } from "./env";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/**
 * Try to authenticate using the simple JWT (username/password login).
 */
async function trySimpleJwtAuth(req: CreateExpressContextOptions["req"]): Promise<User | null> {
  try {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;
    const cookies = parseCookieHeader(cookieHeader);
    const token = cookies[COOKIE_NAME];
    if (!token) return null;

    const secret = new TextEncoder().encode(
      ENV.cookieSecret || process.env.JWT_SECRET || "olixxia-secret-key"
    );
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });

    // Check if this is a simple login token (has sub starting with "simple:")
    const sub = payload.sub as string | undefined;
    if (!sub || !sub.startsWith("simple:")) return null;

    const username = sub.replace("simple:", "");
    const role = (payload.role as string) === "admin" ? "admin" : "user";
    const openId = `simple:${username}`;

    // Try to get or create user in DB
    let user = await db.getUserByOpenId(openId);
    if (!user) {
      try {
        await db.upsertUser({
          openId,
          name: username,
          email: null,
          loginMethod: "simple",
          role,
          lastSignedIn: new Date(),
        });
        user = await db.getUserByOpenId(openId);
      } catch {
        // DB not available, create a virtual user object
      }
    }

    if (user) {
      try { await db.upsertUser({ openId, lastSignedIn: new Date() }); } catch { /* ignore */ }
    } else {
      // Return a virtual user when DB is not available
      const now = new Date();
      user = {
        id: 1,
        openId,
        name: username,
        email: null,
        loginMethod: "simple",
        role: role as "admin" | "user",
        preferredAiModel: "gpt-4",
        organizationName: null,
        organizationType: null,
        province: null,
        createdAt: now,
        updatedAt: now,
        lastSignedIn: now,
      };
    }

    return user;
  } catch {
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // First try simple JWT auth (username/password)
  user = await trySimpleJwtAuth(opts.req);

  // If simple auth failed, try OAuth SDK auth
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
    user,
  };
}
