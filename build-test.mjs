import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('Starting clean build without manus plugins...');

const result = await build({
  root: path.resolve(__dirname, 'client'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
      '@shared': path.resolve(__dirname, 'shared'),
    }
  },
  envDir: __dirname,
  build: {
    outDir: path.resolve(__dirname, 'dist/public'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'client/index.html'),
    }
  },
  logLevel: 'info',
});

console.log('Build complete. Output files:');
if (result && result.output) {
  result.output.forEach(o => {
    const size = o.code?.length || o.source?.length || 0;
    console.log(`  ${o.fileName}: ${(size/1024).toFixed(1)}KB`);
  });
}
