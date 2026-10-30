// League lookup (username -> league picker, or a pasted league ID) and the Score action.
import { $, status, esc } from './util.js';
import { state } from './state.js';
import { get } from './sleeper.js';
import { save } from './storage.js';
import { render } from './teams.js';
import { autofillFromLeague } from './roster.js';
import { loadMembers } from './members.js';
import { isUpcoming, loadProjections } from './projections.js';

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
    state.userId = '';
    pick.hidden = true;
    return;
  }
  status('Finding leagues for ' + input + '…');
  const user = await get('/user/' + encodeURIComponent(input));
  if (!user || !user.user_id) throw new Error('No Sleeper user named ' + input);
  state.userId = user.user_id;
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

// Once a league is chosen: load its managers, optionally autofill both teams, then score.
async function leagueReady(fill) {
  try { await loadMembers(state.leagueId); } catch (e) { /* manager picker just stays empty */ }
  render();
  if (fill) await autofillFromLeague(render);
  score();
}

// Look up leagues as soon as the user stops typing, so the picker is ready before scoring.
let lookupTimer;
// fill: the user just typed or changed the username/league, so also autofill the teams (not on page load).
export function lookupLeagues(fill) {
  clearTimeout(lookupTimer);
  lookupTimer = setTimeout(async () => {
    const input = $('league').value.trim();
    if (!input) { $('pick').hidden = true; return; }
    try {
      await resolveLeague();
      if (fill) leagueReady(true);
      else loadMembers(state.leagueId).catch(() => {}).then(() => { render(); score(); });
    } catch (e) {
      status(e.message);
    }
  }, LOOKUP_DELAY_MS);
}

// "All weeks" stops at the current week when scoring the current season.
function lastWeek() {
  return state.currentWeek && $('season').value == state.currentSeason ? Math.max(1, state.currentWeek) : DEFAULT_WEEKS;
}

function finishScoring() {
  $('go').disabled = false;
  $('go').textContent = 'Refresh scores';
  $('cols').classList.remove('busy');
}

export async function score() {
  const season = $('season').value;
  const week = $('week').value;
  save('prefs', { league: $('league').value, season, week });
  $('go').disabled = true;
  $('go').textContent = 'Scoring…';
  $('cols').classList.add('busy');
  try {
    try {
      await resolveLeague();
    } catch (e) {
      status(e.message, true);
      state.stats = null;
      state.proj = null;
      finishScoring();
      render();
      return;
    }
    status('Loading league scoring…');
    const league = await get('/league/' + state.leagueId);
    if (!league || !league.scoring_settings) throw new Error('No league found for that ID');
    state.scoring = league.scoring_settings;

    status('Loading stats…');
    state.proj = null;
    if (isUpcoming(season, week)) {
      // Unplayed week: stats may be empty or missing, so projections are the main data.
      state.stats = await get(`/stats/nfl/regular/${season}/${week}`).catch(() => ({}));
      state.proj = await loadProjections(season, week);
    } else if (week === 'all') {
      const weeks = Array.from({ length: +lastWeek() }, (_, i) => get(`/stats/nfl/regular/${season}/${i + 1}`).catch(() => ({})));
      state.stats = await Promise.all(weeks);
    } else {
      state.stats = await get(`/stats/nfl/regular/${season}/${week}`);
    }
    status((week === 'all' ? `Season ${season}, all weeks` : `Season ${season}, week ${week}`) + (state.proj ? ' (projected)' : ''));
  } catch (err) {
    status('Could not load stats: ' + err.message, true);
    state.stats = null;
    state.proj = null;
  }
  finishScoring();
  render();
}

export function initLeagueControls() {
  $('pick').addEventListener('change', () => {
    state.leagueId = $('pick').value;
    if (state.leagueId) leagueReady(true);
  });
  $('league').addEventListener('input', () => {
    $('pick').hidden = true;
    state.leagueId = '';
    lookupLeagues(true);
  });
  $('league').addEventListener('keydown', e => { if (e.key === 'Enter') lookupLeagues(true); });
  $('week').addEventListener('change', () => { if (state.leagueId) score(); });
  $('season').addEventListener('change', () => {
    const input = $('league').value.trim();
    if (input && !isLeagueId(input)) {
      $('pick').value = '';
      lookupLeagues(true);
    } else if (state.leagueId) {
      score();
    }
  });
  $('go').addEventListener('click', score);
}
