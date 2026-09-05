/** Nav links rendered by the shell; add a route here to expose it in the header. */
export const navLinks = [
  { name: 'home', path: '/', label: 'Início' },
  { name: 'about', path: '/sobre', label: 'Sobre' },
]

export const shell = /* html */ `
  <div class="min-h-dvh flex flex-col bg-slate-50 text-slate-900">
    <header class="border-b border-slate-200 bg-white">
      <nav class="mx-auto flex max-w-4xl items-center gap-6 px-6 py-4">
        <a href="#/" class="font-semibold tracking-tight text-brand-600" x-text="$store.app.title"></a>
        <ul class="flex gap-1 text-sm">
          <template x-for="link in navLinks" :key="link.name">
            <li>
              <a
                :href="'#' + link.path"
                x-text="link.label"
                class="rounded-md px-3 py-1.5 transition hover:bg-slate-100"
                :class="$store.router.is(link.name) ? 'bg-brand-50 font-medium text-brand-600' : 'text-slate-600'"
              ></a>
            </li>
          </template>
        </ul>
      </nav>
    </header>

    <main id="view" class="mx-auto w-full max-w-4xl flex-1 px-6 py-10"></main>

    <footer class="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
      CodeCon · Urna Eletrônica
    </footer>
  </div>
`
