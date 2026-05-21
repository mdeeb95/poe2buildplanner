import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

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
      "@/lib": path.join(root, "lib"),
      "@/components": path.join(root, "components"),
      "@": path.join(root, "src"),
    },
  },
});
