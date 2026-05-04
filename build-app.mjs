/**
 * Custom build script for Olixxia
 * 1. Runs vite build (generates manus-runtime + CSS in index.html)
 * 2. Compiles main.tsx with esbuild into app.js
 * 3. Injects app.js script into the index.html before </body>
 */

import { build } from 'vite';
import { build as esbuild } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔨 Step 1: Vite build (CSS + manus-runtime)...');

// Step 1: Run vite build to get CSS + manus-runtime in index.html
const { execSync } = await import('child_process');
execSync('npx vite build', { cwd: __dirname, stdio: 'inherit' });

console.log('🔨 Step 2: esbuild compiling main.tsx...');

// Step 2: Compile main.tsx with esbuild
await esbuild({
  entryPoints: [path.resolve(__dirname, 'client/src/main.tsx')],
  bundle: true,
  outfile: path.resolve(__dirname, 'dist/public/assets/app.js'),
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  minifyWhitespace: true,
  minifyIdentifiers: true,
  minifySyntax: true,
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
  splitting: false,
  treeShaking: true,
});

console.log('✅ App bundle compiled to dist/public/assets/app.js');

// Step 3: Inject app.js into index.html
console.log('🔨 Step 3: Injecting app.js into index.html...');

const indexPath = path.resolve(__dirname, 'dist/public/index.html');
let html = fs.readFileSync(indexPath, 'utf-8');

// Remove the uncompiled main.tsx script tag
html = html.replace(/<script type="module" src="\/src\/main\.tsx"><\/script>/g, '');

// Add the compiled app.js before </body>
html = html.replace('</body>', `  <script src="/assets/app.js"></script>\n</body>`);

fs.writeFileSync(indexPath, html);

console.log('✅ Build complete! Files:');
console.log('  dist/public/index.html');
console.log('  dist/public/assets/app.js');
