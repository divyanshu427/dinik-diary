import { defineConfig } from "vitest/config";

// Vite 8 compiles TSX and resolves the "@/" alias from tsconfig on its own,
// so no extra plugins are needed.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
