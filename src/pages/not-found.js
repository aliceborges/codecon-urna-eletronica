export default {
  name: 'notFound',
  // Never matched directly — the router falls back to this route.
  path: '/404',
  title: 'Não encontrado',

  template: /* html */ `
    <section class="space-y-4 text-center">
      <p class="text-6xl font-semibold text-slate-300">404</p>
      <h1 class="text-2xl font-semibold tracking-tight">Página não encontrada</h1>
      <a href="#/" class="inline-block text-brand-600 underline">Voltar ao início</a>
    </section>
  `,
}
