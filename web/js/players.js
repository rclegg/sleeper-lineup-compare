import { get } from './sleeper.js';
import { load, save } from './storage.js';

export const POS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
const DAY_MS = 864e5;

const fullName = x => x.first_name + ' ' + x.last_name;

// Reduces Sleeper's large player dump to the skill positions, K and DEF that have a team.
function slimPlayers(all) {
  const slim = {};
  for (const id in all) {
    const x = all[id];
    const pos = (x.fantasy_positions || [])[0] || x.position;
    if (!POS.includes(pos)) continue;
    if (pos !== 'DEF' && !x.team) continue;
    slim[id] = {
      n: pos === 'DEF' ? fullName(x) : (x.full_name || fullName(x)),
      p: pos,
      t: x.team || '',
    };
  }
  return slim;
}

// Player list, cached in localStorage for a day.
export async function loadPlayers() {
  const meta = load('players_meta', null);
  if (meta && Date.now() - meta.t < DAY_MS) {
    try {
      const raw = localStorage.getItem('lc_players');
      if (raw) return JSON.parse(raw);
    } catch (e) { /* fall through to a fresh fetch */ }
  }
  const slim = slimPlayers(await get('/players/nfl'));
  save('players_meta', { t: Date.now() });
  save('players', slim);
  return slim;
}

export const buildIndex = players =>
  Object.entries(players).map(([id, p]) => ({ id, n: p.n, p: p.p, t: p.t, l: p.n.toLowerCase() }));
