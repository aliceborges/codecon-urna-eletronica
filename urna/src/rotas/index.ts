import { createRouter, createWebHashHistory } from 'vue-router'
import { urnaEstaConfigurada } from '../servicos/logicaUrna'
import { reiniciarSessaoVotacao, votacaoConcluida } from '../estado/sessaoVotacao'
import PaginaConfiguracao from '../paginas/PaginaConfiguracao.vue'
import PaginaExportacao from '../paginas/PaginaExportacao.vue'
import PaginaSucesso from '../paginas/PaginaSucesso.vue'
import PaginaVotacao from '../paginas/PaginaVotacao.vue'

const roteador = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'votacao',
      component: PaginaVotacao,
    },
    {
      path: '/configuracao',
      name: 'configuracao',
      component: PaginaConfiguracao,
    },
    {
      path: '/sucesso',
      name: 'sucesso',
      component: PaginaSucesso,
    },
    {
      path: '/exportacao',
      name: 'exportacao',
      component: PaginaExportacao,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

roteador.beforeEach((para, de) => {
  if (!urnaEstaConfigurada()) {
    reiniciarSessaoVotacao()

    if (para.name !== 'configuracao') return { name: 'configuracao' }
    return true
  }

  if (para.name === 'sucesso' && !votacaoConcluida.value) {
    return { name: 'votacao' }
  }

  if (de.name === 'sucesso' && para.name === 'votacao') {
    reiniciarSessaoVotacao()
  }

  return true
})

export default roteador
