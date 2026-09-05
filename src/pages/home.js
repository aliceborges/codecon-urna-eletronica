export default {
  name: 'home',
  path: '/',
  title: 'Início',

  // Component state for this page, registered as Alpine.data('homePage').
  data: () => ({
    count: 0,

    increment() {
      this.count++
    },
  }),

  template: /* html */ `
    <section x-data="homePage" class="space-y-6">
      <div>
        <h1 class="text-3xl font-semibold tracking-tight">Bem-vindo</h1>
        <p class="mt-2 text-slate-600">
          Esqueleto de SPA em Alpine.js com Vite e Tailwind. Comece por aqui.
        </p>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-6">
        <p class="text-sm text-slate-500">Estado local do componente</p>
        <p class="mt-1 text-4xl font-semibold tabular-nums" x-text="count"></p>
        <button
          @click="increment"
          class="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-500"
        >
          Incrementar
        </button>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-6">
        <p class="text-sm text-slate-500">Rota com parâmetro</p>
        <a href="#/itens/42" class="mt-1 inline-block text-brand-600 underline">
          Abrir item 42
        </a>
      </div>
    </section>
  `,
}
