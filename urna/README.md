# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

## PWA e uso offline

O build de produção gera o Web App Manifest e um service worker que mantém em cache o
shell completo da urna, incluindo a lógica de provisionamento. Depois do primeiro acesso,
a aplicação pode ser instalada e aberta sem conexão.

```sh
npm run build
npm run preview
```

Para testar, abra a URL exibida pelo `preview` uma vez com conexão, aguarde o aviso de que
a urna está pronta para funcionar offline e então recarregue a página sem rede. Em produção,
sirva o conteúdo de `dist/` por HTTPS (ou `localhost` durante o desenvolvimento), requisito
dos navegadores para registrar service workers.
