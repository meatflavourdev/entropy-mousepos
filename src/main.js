import App from './App.svelte';
import * as Y from 'yjs';
  import { WebsocketProvider } from 'y-websocket';
  import { array, map } from 'svelt-yjs';

var app = new App({
  target: document.body,
});

export default app;

// Hot Module Replacement (HMR) - Remove this snippet to remove HMR.
// Learn more: https://www.snowpack.dev/#hot-module-replacement
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => {
    app.$destroy();
  });
}
