import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

/**
 * `/paleta` (sem barra final) cairia no fallback de SPA e serviria a apuração.
 * Reescreve para `/paleta/`, que resolve em paleta/index.html. A maioria dos
 * hosts estáticos já faz isso sozinha em produção.
 */
function paletaSemBarra() {
  const reescrever = (req, _res, next) => {
    if (req.url === '/paleta' || req.url.startsWith('/paleta?')) {
      req.url = req.url.replace('/paleta', '/paleta/')
    }
    next()
  }
  // As chaves importam: devolver o retorno de `use()` faria o Vite tratá-lo
  // como hook de pós-instalação e chamá-lo sem request.
  return {
    name: 'paleta-sem-barra',
    configureServer(server) {
      server.middlewares.use(reescrever)
    },
    configurePreviewServer(server) {
      server.middlewares.use(reescrever)
    },
  }
}

export default defineConfig({
  plugins: [tailwindcss(), paletaSemBarra()],
  server: { port: 5173, open: true },
  build: {
    rollupOptions: {
      input: {
        // A apuração e a página de referência da paleta (/paleta).
        main: resolve(import.meta.dirname, 'index.html'),
        paleta: resolve(import.meta.dirname, 'paleta/index.html'),
      },
    },
  },
})
