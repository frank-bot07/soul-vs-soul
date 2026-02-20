/** Entry point — wires router + state + components */
import { Router } from './router.js';
import { store } from './state.js';
import { LandingHero } from './components/LandingHero.js';
import { AgentPicker } from './components/AgentPicker.js';
import { GameArena } from './components/GameArena.js';
import { ReplayPlayer } from './components/ReplayPlayer.js';
import { Leaderboard } from './components/Leaderboard.js';
import { UserProfile } from './components/UserProfile.js';
import { AgentBrowser } from './components/AgentBrowser.js';
import { GameLobby } from './components/GameLobby.js';
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
      void api.getGameResults(id).then((results) => {
        const section = h('section', { class: 'game-results' },
          h('h1', {}, '🏆 Game Over'),
          h('p', {}, `Status: ${results.status}`),
        );
        if (results.winner) {
          section.append(h('p', { class: 'winner-name' }, `Winner: ${results.winner}`));
        }
        const replayLink = h('a', { class: 'btn btn-primary', href: `#/replay/${id}` }, '📹 Watch Replay');
        section.append(replayLink);
        render(app, section);
      }).catch((err: Error) => {
        ErrorState(app, err.message, () => router.resolve());
      });
    } else {
      GameArena(app, id);
    }
  }).catch((err: Error) => {
    ErrorState(app, err.message, () => router.resolve());
  });
});

router.add('/replay/:id', (params) => {
  const id = params['id'];
  if (!id) return;
  store.update({ route: `#/replay/${id}` });
  ReplayPlayer(app, id);
});

router.add('/leaderboard', () => {
  store.update({ route: '#/leaderboard' });
  Leaderboard(app);
});

router.add('/profile/:id', (params) => {
  const id = params['id'];
  if (!id) return;
  store.update({ route: `#/profile/${id}` });
  UserProfile(app, id);
});

router.add('/agents', () => {
  store.update({ route: '#/agents' });
  AgentBrowser(app);
});

router.add('/lobby', () => {
  store.update({ route: '#/lobby' });
  GameLobby(app);
});

router.start();
