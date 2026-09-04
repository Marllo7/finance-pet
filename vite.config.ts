import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages: сайт живёт по /finance-pet/ — base обязателен, иначе белый экран (ассеты 404)
  // При переходе на Cloudflare Pages заменить на: base: '/'
  base: '/finance-pet/',
  plugins: [react(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5173, open: false },
})
