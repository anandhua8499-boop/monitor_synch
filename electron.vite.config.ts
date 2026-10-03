import { resolve } from 'path'
import {
  defineConfig,
  externalizeDepsPlugin,
} from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: resolve(
          __dirname,
          'electron/main.ts',
        ),
      },
    },

    plugins: [
      externalizeDepsPlugin(),
    ],
  },

  preload: {
    build: {
      rollupOptions: {
        input: resolve(
          __dirname,
          'electron/preload.ts',
        ),
        output: {
          format: 'cjs',
          entryFileNames: 'preload.js',
        },
      },
    },

    plugins: [
      externalizeDepsPlugin(),
    ],
  },

  renderer: {
    root: resolve(
      __dirname,
      'src/renderer',
    ),

    build: {
      rollupOptions: {
        input: resolve(
          __dirname,
          'src/renderer/index.html',
        ),
      },
    },

    plugins: [
      react(),
    ],
  },
})