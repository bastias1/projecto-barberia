import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // un solo archivo a la vez: todos comparten la base de pruebas
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 600_000,
  },
});
