import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import jsconfigPaths from 'vite-jsconfig-paths';

export default defineConfig(({ mode }) => {
  return {
    server: {
      host: 'localhost',
      port: 5173,
      open: true
    },
    define: {
      global: 'window'
    },
    resolve: {
      alias: []
    },
    css: {
      preprocessorOptions: {
        scss: { charset: false },
        less: { charset: false }
      },
      charset: false,
      postcss: {
        plugins: [
          {
            postcssPlugin: 'internal:charset-removal',
            AtRule: {
              charset: (atRule) => {
                if (atRule.name === 'charset') {
                  atRule.remove();
                }
              }
            }
          }
        ]
      }
    },
    base: '/', // ✅ Set base to '/' to remove the long path
    plugins: [react({ jsxRuntime: 'classic' }), jsconfigPaths()]
  };
});