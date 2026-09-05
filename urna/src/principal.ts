import { createApp } from 'vue'
import './estilos.css'
import Aplicacao from './Aplicacao.vue'
import roteador from './rotas'
import { inicializarPwa } from './estado/pwa'

inicializarPwa()
createApp(Aplicacao).use(roteador).mount('#app')
