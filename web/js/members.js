// The loaded league's managers (rosters joined to their owners), and weekly matchup lookup.
import { state } from './state.js';
import { get } from './sleeper.js';

const pending = {};

// Loads the managers once per league; concurrent callers share one request.
export function loadMembers(leagueId) {
  if (state.membersFor === leagueId) return Promise.resolve();
  if (!pending[leagueId]) {
    pending[leagueId] = Promise.all([get(`/league/${leagueId}/rosters`), get(`/league/${leagueId}/users`)])
      .then(([rosters, users]) => {
        state.rostered = new Set((rosters || []).flatMap(r => [...(r.players || []), ...(r.reserve || []), ...(r.taxi || [])]));
        const owners = new Map((users || []).map(u => [u.user_id, u]));
        state.members = (rosters || []).filter(r => r.owner_id).map(r => {
          const u = owners.get(r.owner_id) || {};
          const owner = u.display_name || '';
          return { rosterId: r.roster_id, userId: r.owner_id, owner, name: (u.metadata || {}).team_name || owner || 'Team ' + r.roster_id, starters: r.starters || [], players: r.players || [] };
        });
        state.membersFor = leagueId;
      })
      .finally(() => { delete pending[leagueId]; });
  }
  return pending[leagueId];
}

const games = {};

// A league week's matchups, cached per league+week (failures are not cached).
export function weekGames(leagueId, week) {
  const key = leagueId + ':' + week;
  if (!games[key]) games[key] = get(`/league/${leagueId}/matchups/${week}`).catch(e => { delete games[key]; throw e; });
  return games[key];
}

// True when the picked week is already over: an earlier season, or an earlier week this season.
export function isPastWeek(season, week) {
  if (week === 'all' || !state.currentSeason) return false;
  return +season < +state.currentSeason || (season == state.currentSeason && +week < state.currentWeek);
}

// Who a roster actually started that week (past weeks only); otherwise, or if unavailable, the fallback.
export async function weekStarters(leagueId, rosterId, fallback, season, week) {
  if (!isPastWeek(season, week)) return fallback;
  try {
    const mine = ((await weekGames(leagueId, week)) || []).find(g => g.roster_id === rosterId);
    return mine && mine.starters && mine.starters.length ? mine.starters : fallback;
  } catch (e) { return fallback; }
}

// The manager a roster plays in the given week, or null (bye, offseason, unknown week).
export async function opponentOf(rosterId, week) {
  const games = await weekGames(state.leagueId, week);
  const mine = (games || []).find(g => g.roster_id === rosterId);
  if (!mine || mine.matchup_id == null) return null;
  const other = games.find(g => g.matchup_id === mine.matchup_id && g.roster_id !== rosterId);
  return other ? state.members.find(m => m.rosterId === other.roster_id) || null : null;
}
