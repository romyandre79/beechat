import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      __API_SERVER__: JSON.stringify(process.env.APP_SERVER || 'localhost'),
      __API_PORT__: JSON.stringify(process.env.APP_PORT || '3000')
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true' ? {
        protocol: 'wss',
        clientPort: 443
      } : false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      allowedHosts: [
        'beechat.duckdns.org'
      ],
      proxy: {
        '/api': {
          target: `http://${process.env.APP_SERVER || 'localhost'}:${process.env.APP_PORT || '3000'}`,
          changeOrigin: true
        },
        '/uploads': {
          target: `http://${process.env.APP_SERVER || 'localhost'}:${process.env.APP_PORT || '3000'}`,
          changeOrigin: true
        }
      }
    },
  };
});
