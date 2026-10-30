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
        const owners = new Map((users || []).map(u => [u.user_id, u]));
        state.members = (rosters || []).filter(r => r.owner_id).map(r => {
          const u = owners.get(r.owner_id) || {};
          const owner = u.display_name || '';
          return { rosterId: r.roster_id, userId: r.owner_id, owner, name: (u.metadata || {}).team_name || owner || 'Team ' + r.roster_id, starters: r.starters || [] };
        });
        state.membersFor = leagueId;
      })
      .finally(() => { delete pending[leagueId]; });
  }
  return pending[leagueId];
}

// The manager a roster plays in the given week, or null (bye, offseason, unknown week).
export async function opponentOf(rosterId, week) {
  const games = await get(`/league/${state.leagueId}/matchups/${week}`);
  const mine = (games || []).find(g => g.roster_id === rosterId);
  if (!mine || mine.matchup_id == null) return null;
  const other = games.find(g => g.matchup_id === mine.matchup_id && g.roster_id !== rosterId);
  return other ? state.members.find(m => m.rosterId === other.roster_id) || null : null;
}
