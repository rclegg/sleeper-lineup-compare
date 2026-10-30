// Fills a team's starting lineup from Sleeper when its name is a Sleeper username
// (or a team/display name in the loaded league).
import { status } from './util.js';
import { state } from './state.js';
import { get } from './sleeper.js';
import { save, load } from './storage.js';
import { opponentOf } from './members.js';

const LOOKUP_DELAY_MS = 700;
export const autofillOn = () => load('autofill', true) !== false;

const timers = [];
const latest = [];

// Picks the league to read rosters from: the loaded one, else the user's only league this season.
async function leagueFor(userId, season) {
  if (state.leagueId) return state.leagueId;
  const leagues = await get(`/user/${userId}/leagues/nfl/${season}`);
  return leagues && leagues.length === 1 ? leagues[0].league_id : '';
}

// Resolves a name to starter ids, or null when the name matches nobody.
async function startersFor(name, season) {
  let user = null;
  try { user = await get('/user/' + encodeURIComponent(name)); } catch (e) { /* not a username */ }
  const wanted = name.toLowerCase();

  if (user && user.user_id) {
    const leagueId = await leagueFor(user.user_id, season);
    if (!leagueId) return { error: `Found ${user.display_name || name}, but pick a league above to load their lineup.` };
    const rosters = await get(`/league/${leagueId}/rosters`);
    const roster = (rosters || []).find(r => r.owner_id === user.user_id);
    if (!roster) return { error: `${user.display_name || name} has no team in that league.` };
    return { ids: roster.starters || [], who: user.display_name || name };
  }

  if (!state.leagueId) return null;
  const [rosters, users] = await Promise.all([get(`/league/${state.leagueId}/rosters`), get(`/league/${state.leagueId}/users`)]);
  const owner = (users || []).find(u => [u.display_name, u.username, (u.metadata || {}).team_name]
    .some(v => v && v.toLowerCase() === wanted));
  const roster = owner && (rosters || []).find(r => r.owner_id === owner.user_id);
  return roster ? { ids: roster.starters || [], who: owner.display_name || name } : null;
}

// Looks the name up and, if it resolves and this is still the latest request, fills the team.
async function fillTeam(teamIndex, name, ticket, render) {
  try {
    const season = document.getElementById('season').value;
    const found = await startersFor(name, season);
    if (ticket !== latest[teamIndex] || !found) return;
    if (found.error) { status(found.error); return; }
    // "0" marks an empty slot; ids missing from the player list (e.g. IDP) are skipped.
    const ids = found.ids.filter(id => id !== '0' && state.players[id]);
    if (!ids.length) { status(`${found.who} has no starters set.`); return; }
    state.teams[teamIndex].ids = ids;
    if (/^team [ab]$/i.test(state.teams[teamIndex].name.trim())) state.teams[teamIndex].name = found.who;
    save('teams', state.teams);
    render();
    status(`Loaded ${found.who}'s starting lineup.`);
  } catch (e) { /* offline or API hiccup: leave the lineup alone */ }
}

// Called as a team name is typed. Debounced; a later keystroke cancels an in-flight result.
export function lookupRoster(teamIndex, render) {
  clearTimeout(timers[teamIndex]);
  const name = state.teams[teamIndex].name.trim();
  const ticket = (latest[teamIndex] = (latest[teamIndex] || 0) + 1);
  if (!autofillOn() || !name || /^team [ab]$/i.test(name)) return;
  timers[teamIndex] = setTimeout(() => fillTeam(teamIndex, name, ticket, render), LOOKUP_DELAY_MS);
}

const DEFAULT_NAME = /^team [ab]$/i;

// "0" marks an empty slot; ids missing from the player list (e.g. IDP) are skipped.
const playable = ids => ids.filter(id => id !== '0' && state.players[id]);

// Puts a league manager's starters into a team. The name follows unless the user chose their own.
export function applyMember(teamIndex, member, force) {
  const team = state.teams[teamIndex];
  team.ids = playable(member.starters);
  if (force || DEFAULT_NAME.test(team.name.trim())) team.name = member.name;
  save('teams', state.teams);
}

// With a username in the league box: Team A becomes that manager and Team B their opponent this week.
export async function autofillFromLeague(render) {
  if (!autofillOn() || !state.userId) return;
  const me = state.members.find(m => m.userId === state.userId);
  if (!me) return;
  applyMember(0, me);
  render();
  let opponent = null;
  if (!state.teams[1].ids.length) {
    const picked = document.getElementById('week').value;
    const week = picked === 'all' ? state.currentWeek || 1 : picked;
    try { opponent = await opponentOf(me.rosterId, week); } catch (e) { /* no matchup data */ }
    if (opponent) applyMember(1, opponent);
  }
  render();
  status(opponent ? `${me.name} vs ${opponent.name}` : `Loaded ${me.name}'s starting lineup.`);
}

export function initAutofillToggle() {
  const box = document.getElementById('autofill');
  box.checked = autofillOn();
  box.addEventListener('change', () => save('autofill', box.checked));
}
