/**
 * Hash-based client-side router.
 *
 * Hash routing keeps the app deployable to any static host without server
 * rewrite rules. Swap to the History API later by replacing read()/write().
 */

/** Turns '/items/:id' into a regex plus the ordered list of param names. */
function compile(path) {
  const keys = []
  const pattern = path
    .replace(/\/:([^/]+)/g, (_, key) => {
      keys.push(key)
      return '/([^/]+)'
    })
    .replace(/\//g, '\\/')
  return { regex: new RegExp(`^${pattern}$`), keys }
}

function read() {
  return window.location.hash.slice(1) || '/'
}

export function createRouter(Alpine, pages) {
  const routes = pages.map((page) => ({ ...page, ...compile(page.path) }))
  const fallback = routes.find((route) => route.name === 'notFound')

  function match(path) {
    for (const route of routes) {
      const found = route.regex.exec(path)
      if (!found) continue
      const params = Object.fromEntries(
        route.keys.map((key, i) => [key, decodeURIComponent(found[i + 1])]),
      )
      return { route, params }
    }
    return { route: fallback, params: {} }
  }

  Alpine.store('router', {
    path: read(),
    route: null,
    params: {},

    init() {
      this.resolve()
      window.addEventListener('hashchange', () => this.resolve())
    },

    resolve() {
      this.path = read()
      const { route, params } = match(this.path)
      this.route = route
      this.params = params
      document.title = route.title ? `${route.title} · Urna Eletrônica` : 'Urna Eletrônica'
    },

    /** Navigate programmatically: $store.router.go('/sobre'). */
    go(path) {
      window.location.hash = path
    },

    /** True when `name` is the active route — handy for nav highlighting. */
    is(name) {
      return this.route?.name === name
    },
  })

  return Alpine.store('router')
}
