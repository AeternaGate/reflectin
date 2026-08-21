import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// ponytail: SPA, base "/" — Netlify serves from root; relative API calls hit same origin when VITE_API_BASE unset.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/",
});
