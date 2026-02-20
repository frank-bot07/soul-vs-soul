/** Entry point — wires router + state + components */
import { Router } from './router.js';
import { store } from './state.js';
import { LandingHero } from './components/LandingHero.js';
import { AgentPicker } from './components/AgentPicker.js';
import { GameArena } from './components/GameArena.js';
import { LoadingState } from './components/LoadingState.js';
import { ErrorState } from './components/ErrorState.js';
import { h, render } from './dom.js';
import * as api from './lib/api.js';

const app = document.getElementById('app')!;
const router = new Router();

router.add('/', () => {
  store.update({ route: '#/' });
  LandingHero(app, () => {
    location.hash = '#/pick';
  });
});

router.add('/pick', () => {
  store.update({ route: '#/pick' });
  AgentPicker(app);
});

router.add('/game/:id', (params) => {
  const id = params['id'];
  if (!id) return;
  store.update({ route: `#/game/${id}` });
  LoadingState(app, 'Loading game…');

  void api.getGame(id).then((game) => {
    if (game.status === 'completed') {
      // Show results for completed game
      void api.getGameResults(id).then((results) => {
        const section = h('section', { class: 'game-results' },
          h('h1', {}, '🏆 Game Over'),
          h('p', {}, `Status: ${results.status}`),
        );
        if (results.winner) {
          section.append(h('p', { class: 'winner-name' }, `Winner: ${results.winner}`));
        }
        render(app, section);
      }).catch((err: Error) => {
        ErrorState(app, err.message, () => router.resolve());
      });
    } else {
      // Live game — join as spectator
      GameArena(app, id);
    }
  }).catch((err: Error) => {
    ErrorState(app, err.message, () => router.resolve());
  });
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
