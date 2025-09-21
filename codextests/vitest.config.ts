import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  root: path.resolve(__dirname, ".."),
  test: {
    globals: true,
    environment: "jsdom",
    include: ["codextests/**/*.test.{ts,tsx}"]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../src")
    }
  }
})
