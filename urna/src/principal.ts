import { createApp } from 'vue'
import './estilos.css'
import Aplicacao from './Aplicacao.vue'
import roteador from './rotas'

createApp(Aplicacao).use(roteador).mount('#app')
