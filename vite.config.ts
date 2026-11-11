import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { makePicturesStudioServerPlugin } from './scripts/studio-server-plugin';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const coreSrcDir = path.resolve(rootDir, 'packages/core/src');
const kitsSrcDir = path.resolve(rootDir, 'packages/kits/src');
const studioSrcDir = path.resolve(rootDir, 'packages/studio/src');

export default defineConfig({
  plugins: [react(), makePicturesStudioServerPlugin({ rootDir })],
  publicDir: 'public',
  resolve: {
    alias: [
      {
        find: /^@make-pictures\/core\/(.*)$/,
        replacement: `${coreSrcDir}/$1`,
      },
      {
        find: /^@make-pictures\/core$/,
        replacement: path.resolve(coreSrcDir, 'index.ts'),
      },
      {
        find: /^@make-pictures\/kits\/(.*)$/,
        replacement: `${kitsSrcDir}/$1`,
      },
      {
        find: /^@make-pictures\/kits$/,
        replacement: path.resolve(kitsSrcDir, 'index.ts'),
      },
      {
        find: /^@make-pictures\/studio\/styles\.css$/,
        replacement: path.resolve(studioSrcDir, 'client/styles.css'),
      },
      {
        find: /^@make-pictures\/studio\/(.*)$/,
        replacement: `${studioSrcDir}/$1`,
      },
      {
        find: /^@make-pictures\/studio$/,
        replacement: path.resolve(studioSrcDir, 'index.ts'),
      },
    ],
  },
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: false,
    fs: {
      allow: [rootDir],
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'remotion',
      '@remotion/player',
      '@remotion/three',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      'lucide-react',
      'zod',
    ],
  },
});
