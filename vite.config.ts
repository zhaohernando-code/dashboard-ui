import { webcrypto } from "node:crypto";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as Crypto;
}

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/scheduler")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/antd")) {
            return "vendor-antd";
          }
          if (id.includes("node_modules/@ant-design")) {
            return "vendor-ant-icons";
          }
          if (id.includes("node_modules")) {
            return "vendor-misc";
          }
          return undefined;
        },
      },
    },
  },
});
