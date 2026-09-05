import Alpine from 'alpinejs'
import './style.css'

import { createRouter } from './router.js'
import { createStore } from './store.js'
import { navLinks, shell } from './components/layout.js'

import home from './pages/home.js'
import about from './pages/about.js'
import item from './pages/item.js'
import notFound from './pages/not-found.js'

// Add new pages here. Order matters: the first matching path wins.
const pages = [home, about, item, notFound]

createStore(Alpine)
createRouter(Alpine, pages)

// Each page's optional `data` becomes an Alpine component named `<name>Page`.
for (const page of pages) {
  if (page.data) Alpine.data(`${page.name}Page`, page.data)
}

Alpine.data('appShell', () => ({ navLinks }))

const root = document.getElementById('app')
root.setAttribute('x-data', 'appShell')
root.innerHTML = shell

Alpine.start()

// Swap the view whenever the route changes. Alpine picks up the injected
// markup on its own, so the new page initialises without extra wiring.
const view = document.getElementById('view')
Alpine.effect(() => {
  const route = Alpine.store('router').route
  if (route) view.innerHTML = route.template
})

window.Alpine = Alpine
