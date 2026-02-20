/** Entry point — wires router + state + components */
import { Router } from './router.js';
import { store } from './state.js';
import { AgentPicker } from './components/AgentPicker.js';
import { GameArena } from './components/GameArena.js';
import { h, render } from './dom.js';

const app = document.getElementById('app')!;
const router = new Router();

router.add('/', () => {
  store.update({ route: '#/' });
  AgentPicker(app);
});

router.add('/game/:id', (params) => {
  const id = params['id'];
  if (!id) return;
  store.update({ route: `#/game/${id}` });
  GameArena(app, id);
});

router.add('/leaderboard', () => {
  store.update({ route: '#/leaderboard' });
  const section = h('section', {},
    h('h1', {}, '🏆 Leaderboard'),
    h('p', {}, 'Coming soon…'),
  );
  render(app, section);
});

router.start();
