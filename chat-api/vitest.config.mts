import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC conserva `emitDecoratorMetadata`, del que depende la inyección de dependencias de Nest.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    include: ['test/**/*.spec.ts'],
    environment: 'node',
    fileParallelism: false,
  },
});
