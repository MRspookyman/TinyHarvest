import { defineConfig } from 'vitest/config';

// Herramienta de equilibrado (npm run balance): no son tests, son informes que se imprimen por consola.
export default defineConfig({
  test: {
    include: ['balance/**/*.balance.ts'],
    silent: false,
    reporters: ['verbose'],
    testTimeout: 600_000,
    // sin aislamiento de consola: los console.log salen tal cual, en orden
    disableConsoleIntercept: true,
  },
});
