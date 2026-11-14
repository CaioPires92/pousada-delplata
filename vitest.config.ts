import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // Testes de tela pesados estouravam o limite padrão quando a suíte roda inteira em paralelo
    // (como no build da Vercel), derrubando deploys por motivo nenhum. Só estende o teto: testes
    // que passam rápido continuam rápidos.
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ['./vitest.setup.tsx'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'vitest.config.ts',
        'vitest.setup.ts',
        'postcss.config.js',
        'tailwind.config.ts',
        'eslint.config.mjs',
        'next.config.ts',
        '**/*.d.ts',
        '**/*.js', // Exclude setup scripts from coverage
      ],
    },
  },
});
