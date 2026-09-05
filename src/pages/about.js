export default {
  name: 'about',
  path: '/sobre',
  title: 'Sobre',

  template: /* html */ `
    <section class="space-y-4">
      <h1 class="text-3xl font-semibold tracking-tight">Sobre</h1>
      <p class="text-slate-600">
        Páginas ficam em <code class="rounded bg-slate-200 px-1.5 py-0.5 text-sm">src/pages/</code>.
        Cada arquivo exporta <code class="rounded bg-slate-200 px-1.5 py-0.5 text-sm">name</code>,
        <code class="rounded bg-slate-200 px-1.5 py-0.5 text-sm">path</code>,
        <code class="rounded bg-slate-200 px-1.5 py-0.5 text-sm">template</code> e, opcionalmente,
        <code class="rounded bg-slate-200 px-1.5 py-0.5 text-sm">data</code>.
        Registre a nova página em <code class="rounded bg-slate-200 px-1.5 py-0.5 text-sm">src/main.js</code>.
      </p>
    </section>
  `,
}
