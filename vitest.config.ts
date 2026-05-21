import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    include: [
      "scripts/**/*.test.ts",
      "src/**/*.test.ts",
      "lib/**/*.test.ts",
      "components/**/*.test.tsx",
    ],
    reporters: ["default"],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
