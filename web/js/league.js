// League lookup (username -> league picker, or a pasted league ID) and the Score action.
import { $, status, esc } from './util.js';
import { state } from './state.js';
import { get } from './sleeper.js';
import { save } from './storage.js';
import { render } from './teams.js';

const isLeagueId = v => /^\d{12,}$/.test(v);
const LOOKUP_DELAY_MS = 600;
const DEFAULT_WEEKS = 18;

// Accepts a league ID directly, or a username and offers that user's leagues for the chosen season.
async function resolveLeague() {
  const input = $('league').value.trim();
  const pick = $('pick');
  const season = $('season').value;
  if (!input) {
    pick.hidden = true;
    throw new Error('Enter your Sleeper username or a league ID first.');
  }
  if (isLeagueId(input)) {
    state.leagueId = input;
    pick.hidden = true;
    return;
  }
  status('Finding leagues for ' + input + '…');
  const user = await get('/user/' + encodeURIComponent(input));
  if (!user || !user.user_id) throw new Error('No Sleeper user named ' + input);
  const leagues = await get(`/user/${user.user_id}/leagues/nfl/${season}`);
  if (!leagues || !leagues.length) throw new Error(input + ' has no leagues in ' + season);

  const previous = pick.value;
  pick.innerHTML = (leagues.length > 1 ? '<option value="">Choose a league…</option>' : '')
    + leagues.map(l => `<option value="${l.league_id}">${esc(l.name)}</option>`).join('');
  if (leagues.some(l => l.league_id === previous)) pick.value = previous;
  pick.hidden = false;
  state.leagueId = pick.value;
  if (!state.leagueId) throw new Error(`${input} has ${leagues.length} leagues. Choose one from the list.`);
}

// Look up leagues as soon as the user stops typing, so the picker is ready before scoring.
let lookupTimer;
export function lookupLeagues() {
  clearTimeout(lookupTimer);
  lookupTimer = setTimeout(async () => {
    const input = $('league').value.trim();
    if (!input || isLeagueId(input)) {
      $('pick').hidden = true;
      if (isLeagueId(input)) state.leagueId = input;
      return;
    }
    try {
      await resolveLeague();
      status('Choose a league, then add players and tap Score.');
    } catch (e) {
      status(e.message);
    }
  }, LOOKUP_DELAY_MS);
}

// "All weeks" stops at the current week when scoring the current season.
function lastWeek() {
  return state.currentWeek && $('season').value == state.currentSeason ? Math.max(1, state.currentWeek) : DEFAULT_WEEKS;
}

export async function score() {
  const season = $('season').value;
  const week = $('week').value;
  save('prefs', { league: $('league').value, season, week });
  $('go').disabled = true;
  try {
    try {
      await resolveLeague();
    } catch (e) {
      status(e.message, true);
      state.stats = null;
      $('go').disabled = false;
      render();
      return;
    }
    status('Loading league scoring…');
    const league = await get('/league/' + state.leagueId);
    if (!league || !league.scoring_settings) throw new Error('No league found for that ID');
    state.scoring = league.scoring_settings;

    status('Loading stats…');
    if (week === 'all') {
      const weeks = Array.from({ length: +lastWeek() }, (_, i) => get(`/stats/nfl/regular/${season}/${i + 1}`).catch(() => ({})));
      state.stats = await Promise.all(weeks);
    } else {
      state.stats = await get(`/stats/nfl/regular/${season}/${week}`);
    }
    status(week === 'all' ? `Season ${season}, all weeks` : `Season ${season}, week ${week}`);
  } catch (err) {
    status('Could not load stats: ' + err.message, true);
    state.stats = null;
  }
  $('go').disabled = false;
  render();
}

export function initLeagueControls() {
  $('pick').addEventListener('change', () => {
    state.leagueId = $('pick').value;
    if (state.leagueId) score();
  });
  $('league').addEventListener('input', () => {
    $('pick').hidden = true;
    state.leagueId = '';
    lookupLeagues();
  });
  $('league').addEventListener('keydown', e => { if (e.key === 'Enter') score(); });
  $('season').addEventListener('change', () => {
    const input = $('league').value.trim();
    if (input && !isLeagueId(input)) {
      $('pick').value = '';
      lookupLeagues();
    }
  });
  $('go').addEventListener('click', score);
}
