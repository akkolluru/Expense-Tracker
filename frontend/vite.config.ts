/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api/v1': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    test: {
      environment: 'happy-dom',
      globals: true,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/recharts')) {
              return 'vendor-recharts';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-lucide';
            }
            if (id.includes('node_modules/@tanstack')) {
              return 'vendor-tanstack';
            }
            if (id.includes('node_modules/motion')) {
              return 'vendor-motion';
            }
          },
        },
      },
    },
  };
});
