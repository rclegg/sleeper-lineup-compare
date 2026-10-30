// Sleeper Lineup Compare: scores two lineups with a Sleeper league's own scoring rules.
// Data comes from the public Sleeper API; lineups, prefs and the player cache live in localStorage.
import { $, status } from './js/util.js';
import { state } from './js/state.js';
import { get } from './js/sleeper.js';
import { load, save } from './js/storage.js';
import { loadPlayers, buildIndex } from './js/players.js';
import { render, initTeamEditing } from './js/teams.js';
import { initLeagueControls, lookupLeagues, score } from './js/league.js';
import { readShared, initShare } from './js/share.js';
import { initImage } from './js/image.js';
import { initTheme } from './js/theme.js';
import { initAutofillToggle } from './js/roster.js';
import { initScoring, setScoringChoice } from './js/scoring.js';
import { initStrip } from './js/strip.js';

const SEASONS_SHOWN = 4;
const WEEKS_IN_SEASON = 18;

// Fills the season/week pickers, defaulting to the current season and week.
async function setupPickers(pref) {
  let season = new Date().getFullYear(), week = 1;
  try {
    const nflState = await get('/state/nfl', { cache: 'no-store' });
    season = +nflState.season;
    // week, display_week and leg can disagree around game days; the latest of them is the current week.
    week = Math.max(+nflState.display_week || 0, +nflState.week || 0, +nflState.leg || 0) || 1;
    state.currentSeason = String(season);
    state.currentWeek = week;
  } catch (e) { /* offline: fall back to the calendar year */ }

  const seasonSel = $('season');
  for (let y = season; y > season - SEASONS_SHOWN; y--) seasonSel.add(new Option(y, y));
  seasonSel.value = pref.season || season;

  const weekSel = $('week');
  weekSel.add(new Option('Season total', 'all'));
  for (let i = 1; i <= WEEKS_IN_SEASON; i++) weekSel.add(new Option('Week ' + i, i));
  weekSel.value = pref.week || Math.max(1, week);
}

async function init() {
  const pref = load('prefs', {});
  delete pref.season;  // always open on the current NFL season and week, unless a share link says otherwise
  delete pref.week;
  const shared = readShared();
  if (shared) {
    state.teams = shared.t.map((t, i) => ({
      name: String(t.n || ('Team ' + 'AB'[i])),
      ids: (Array.isArray(t.i) ? t.i : []).map(String),
    }));
    if (shared.s) pref.season = shared.s;
    if (shared.w) pref.week = shared.w;
    // The link has been applied; keep the lineups but drop the hash so a reload (or a bookmark) opens on the current week.
    save('teams', state.teams);
    history.replaceState(null, '', location.pathname + location.search);
    if (shared.l) pref.league = shared.l;
    if (shared.c) setScoringChoice(shared.c);
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
  if ((shared || !$('league').value) && state.index.length) score(); else lookupLeagues();
}

initTeamEditing();
initScoring(render);
initLeagueControls();
initShare();
initImage();
initAutofillToggle();
initStrip();
initTheme();
init();
