import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      react: resolve(__dirname, 'packages/web/node_modules/react'),
      'react-dom': resolve(__dirname, 'packages/web/node_modules/react-dom'),
      'react/jsx-runtime': resolve(__dirname, 'packages/web/node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': resolve(__dirname, 'packages/web/node_modules/react/jsx-dev-runtime'),
      'react-dom/client': resolve(__dirname, 'packages/web/node_modules/react-dom/client'),
      'react-dom/test-utils': resolve(__dirname, 'packages/web/node_modules/react-dom/test-utils'),
      '@monaco-editor/react': resolve(__dirname, 'packages/web/node_modules/@monaco-editor/react'),
      'react-router-dom': resolve(__dirname, 'packages/web/node_modules/react-router-dom'),
      '@testing-library/react': resolve(__dirname, 'packages/web/node_modules/@testing-library/react'),
    },
  },
  test: {
    environmentMatchGlobs: [
      ['packages/web/**', 'jsdom'],
    ],
  },
});