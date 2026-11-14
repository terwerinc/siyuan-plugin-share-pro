import { defineConfig } from "vitest/config"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import { resolve } from "node:path"

export default defineConfig({
  plugins: [svelte({ compilerOptions: { customElement: false } })],
  resolve: { conditions: ["browser"], alias: { siyuan: resolve(__dirname, "src/test/siyuan.ts") } },
  test: { threads: false, environment: "jsdom", setupFiles: ["./src/test/setup.ts"], include: ["src/**/*.test.ts"] },
})
