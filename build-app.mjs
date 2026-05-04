/**
 * Custom build script for Olixxia
 * 1. Runs vite build (generates manus-runtime + CSS in index.html)
 * 2. Compiles main.tsx with esbuild into multiple chunks (code splitting)
 * 3. Injects chunks into the index.html before </body>
 */

import { build as esbuild } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔨 Step 1: Vite build (CSS + manus-runtime)...');

// Step 1: Run vite build to get CSS + manus-runtime in index.html
const { execSync } = await import('child_process');
execSync('npx vite build', { cwd: __dirname, stdio: 'inherit' });

console.log('🔨 Step 2: esbuild compiling main.tsx with code splitting...');

// Step 2: Compile main.tsx with esbuild using code splitting (ESM format)
const assetsDir = path.resolve(__dirname, 'dist/public/assets');
fs.mkdirSync(assetsDir, { recursive: true });

await esbuild({
  entryPoints: [path.resolve(__dirname, 'client/src/main.tsx')],
  bundle: true,
  outdir: assetsDir,
  entryNames: 'app',
  chunkNames: 'chunks/[name]-[hash]',
  format: 'esm',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  minifyWhitespace: true,
  minifyIdentifiers: true,
  minifySyntax: true,
  splitting: true,
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.env.VITE_APP_ID': JSON.stringify(process.env.VITE_APP_ID || ''),
    'import.meta.env.VITE_OAUTH_PORTAL_URL': JSON.stringify(process.env.VITE_OAUTH_PORTAL_URL || ''),
    'import.meta.env.VITE_FRONTEND_FORGE_API_KEY': JSON.stringify(process.env.VITE_FRONTEND_FORGE_API_KEY || ''),
    'import.meta.env.VITE_FRONTEND_FORGE_API_URL': JSON.stringify(process.env.VITE_FRONTEND_FORGE_API_URL || ''),
    'import.meta.env.VITE_ANALYTICS_ENDPOINT': JSON.stringify(process.env.VITE_ANALYTICS_ENDPOINT || ''),
    'import.meta.env.VITE_ANALYTICS_WEBSITE_ID': JSON.stringify(process.env.VITE_ANALYTICS_WEBSITE_ID || ''),
    'import.meta.env.VITE_APP_TITLE': JSON.stringify(process.env.VITE_APP_TITLE || 'Olixxia'),
    'import.meta.env.VITE_APP_LOGO': JSON.stringify(process.env.VITE_APP_LOGO || ''),
    'import.meta.env.DEV': 'false',
    'import.meta.env.PROD': 'true',
    'import.meta.env.MODE': '"production"',
    'import.meta.env.BASE_URL': '"/"',
  },
  alias: {
    '@': path.resolve(__dirname, 'client/src'),
    '@shared': path.resolve(__dirname, 'shared'),
  },
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.jsx': 'jsx',
    '.js': 'js',
    '.css': 'empty', // CSS is handled by vite
    '.svg': 'dataurl',
    '.png': 'dataurl',
    '.jpg': 'dataurl',
  },
  external: [],
  logLevel: 'info',
  treeShaking: true,
});

console.log('✅ App bundle compiled with code splitting');

// Step 3: Inject app.js (ESM module) into index.html
console.log('🔨 Step 3: Injecting app.js into index.html...');

const indexPath = path.resolve(__dirname, 'dist/public/index.html');
let html = fs.readFileSync(indexPath, 'utf-8');

// Remove the uncompiled main.tsx script tag
html = html.replace(/<script type="module" src="\/src\/main\.tsx"><\/script>/g, '');

// Add the compiled app.js as ESM module before </body>
html = html.replace('</body>', `  <script type="module" src="/assets/app.js"></script>\n</body>`);

fs.writeFileSync(indexPath, html);

// Show generated files
const files = fs.readdirSync(assetsDir);
const sizes = files.map(f => {
  const stat = fs.statSync(path.join(assetsDir, f));
  return `  ${f}: ${(stat.size / 1024).toFixed(0)} KB`;
});
console.log('✅ Build complete! Generated files:');
console.log('  dist/public/index.html');
sizes.forEach(s => console.log(s));
