// Sleeper Lineup Compare: scores two lineups with a Sleeper league's own scoring rules.
// Data comes from the public Sleeper API; lineups, prefs and the player cache live in localStorage.
import { $, status } from './js/util.js';
import { state } from './js/state.js';
import { get } from './js/sleeper.js';
import { load } from './js/storage.js';
import { loadPlayers, buildIndex } from './js/players.js';
import { render, initTeamEditing } from './js/teams.js';
import { initLeagueControls, lookupLeagues, score } from './js/league.js';
import { readShared, initShare } from './js/share.js';
import { initImage } from './js/image.js';
import { initTheme } from './js/theme.js';
import { initAutofillToggle } from './js/roster.js';
import { initStrip } from './js/strip.js';

const SEASONS_SHOWN = 4;
const WEEKS_IN_SEASON = 18;

// Fills the season/week pickers, defaulting to the current season and last completed week.
async function setupPickers(pref) {
  let season = new Date().getFullYear(), week = 1;
  try {
    const nflState = await get('/state/nfl');
    season = +nflState.season;
    week = +nflState.display_week || +nflState.week || 1;
    state.currentSeason = String(season);
    state.currentWeek = week;
  } catch (e) { /* offline: fall back to the calendar year */ }

  const seasonSel = $('season');
  for (let y = season; y > season - SEASONS_SHOWN; y--) seasonSel.add(new Option(y, y));
  seasonSel.value = pref.season || season;

  const weekSel = $('week');
  weekSel.add(new Option('Season total', 'all'));
  for (let i = 1; i <= WEEKS_IN_SEASON; i++) weekSel.add(new Option('Week ' + i, i));
  weekSel.value = pref.week || Math.max(1, week - 1);
}

async function init() {
  const pref = load('prefs', {});
  const shared = readShared();
  if (shared) {
    state.teams = shared.t.map((t, i) => ({
      name: String(t.n || ('Team ' + 'AB'[i])),
      ids: (Array.isArray(t.i) ? t.i : []).map(String),
    }));
    if (shared.s) pref.season = shared.s;
    if (shared.w) pref.week = shared.w;
    if (shared.l) pref.league = shared.l;
  }
  $('league').value = pref.league || '';
  $('clear').hidden = !$('league').value;
  await setupPickers(pref);

  try {
    state.players = await loadPlayers();
    state.index = buildIndex(state.players);
    status('Ready. Add players to each team, then tap Score.');
  } catch (e) {
    status('Could not load players: ' + e.message, true);
  }
  render();
  if (shared && state.index.length) score(); else lookupLeagues();
}

initTeamEditing();
initLeagueControls();
initShare();
initImage();
initAutofillToggle();
initStrip();
initTheme();
init();
