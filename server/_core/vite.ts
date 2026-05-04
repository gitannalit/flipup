import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

// Reliable __dirname for both dev (tsx) and production (compiled ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname_vite = path.dirname(__filename);

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // In dev: __dirname_vite = server/_core/, so go up 2 levels to project root, then dist/public
  // In production: __dirname_vite = dist/ (where index.js lives), so go to dist/public
  const isDevMode = process.env.NODE_ENV === "development";
  const distPath = isDevMode
    ? path.resolve(__dirname_vite, "../..", "dist", "public")
    : path.resolve(__dirname_vite, "public");
  
  console.log(`[Static] NODE_ENV=${process.env.NODE_ENV}, serving from: ${distPath}`);
  
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
    // Fallback: try common paths
    const fallbacks = [
      path.resolve(process.cwd(), "dist", "public"),
      path.resolve(__dirname_vite, "..", "public"),
      path.resolve(__dirname_vite, "public"),
    ];
    for (const fb of fallbacks) {
      if (fs.existsSync(fb)) {
        console.log(`[Static] Using fallback path: ${fb}`);
        app.use(express.static(fb));
        app.use("*", (_req, res) => { res.sendFile(path.resolve(fb, "index.html")); });
        return;
      }
    }
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
