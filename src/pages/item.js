export default {
  name: 'item',
  path: '/itens/:id',
  title: 'Item',

  data: () => ({
    // Route params are exposed to every page through the router store.
    get id() {
      return this.$store.router.params.id
    },
  }),

  template: /* html */ `
    <section x-data="itemPage" class="space-y-4">
      <h1 class="text-3xl font-semibold tracking-tight">
        Item <span x-text="id" class="text-brand-600"></span>
      </h1>
      <p class="text-slate-600">Parâmetro lido de <code>$store.router.params.id</code>.</p>
      <a href="#/" class="inline-block text-brand-600 underline">Voltar</a>
    </section>
  `,
}
