/**
 * Global app state, shared by every page: Alpine.store('app').
 * Read it from markup with $store.app.
 */
export function createStore(Alpine) {
  Alpine.store('app', {
    title: 'Urna Eletrônica',
    menuOpen: false,

    toggleMenu() {
      this.menuOpen = !this.menuOpen
    },
  })
}
