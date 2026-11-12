import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages under mbanyadev/njangi-stocks when the repo is public.
export default defineConfig({
  plugins: [react()],
  base: "/njangi-stocks/",
});
