import { webcrypto } from "node:crypto";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as Crypto;
}

export default defineConfig({
  base: "./",
  plugins: [react()],
});
