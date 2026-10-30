// Projected points for weeks that haven't been played yet, scored with the league's own rules.
// Uses Sleeper's undocumented projections endpoint; any failure just means no projections.
import { state } from './state.js';
import { points, playerPoints } from './scoring.js';

const HOST = 'https://api.sleeper.app';

// True for the current week or later in the current season (not "Season total").
export function isUpcoming(season, week) {
  return week !== 'all' && !!state.currentWeek && String(season) === String(state.currentSeason) && +week >= state.currentWeek;
}

// Normalizes either { id: stats } or [{ player_id, stats }] into { id: statLine }.
function toMap(data) {
  const out = {};
  const rows = Array.isArray(data) ? data.map(r => [r && r.player_id, r]) : Object.entries(data || {});
  for (const [id, row] of rows) {
    const line = row && (row.stats || row);
    if (id && line && typeof line === 'object') out[id] = line;
  }
  return Object.keys(out).length ? out : null;
}

// Returns { id: statLine } or null when unavailable.
export async function loadProjections(season, week) {
  const paths = [`/projections/nfl/regular/${season}/${week}?season_type=regular`, `/v1/projections/nfl/regular/${season}/${week}`];
  for (const path of paths) {
    try {
      const res = await fetch(HOST + path);
      if (!res.ok) continue;
      const map = toMap(await res.json());
      if (map) return map;
    } catch (e) { /* try the next path */ }
  }
  return null;
}

// True once a player has a recorded stat line for the loaded week (game played or in progress).
function hasPlayed(id) {
  const line = state.stats && !Array.isArray(state.stats) && state.stats[id];
  return !!line && (line.gp > 0 || Object.values(line).some(v => typeof v === 'number' && v !== 0));
}

// Whether this player's shown points are projections: projections loaded and no actual stats yet.
export const isProjected = id => !!state.proj && !hasPlayed(id);

// Projected points for a player, or null when projections aren't loaded.
export function projectedPoints(id) {
  return state.proj ? points(state.proj[id]) : null;
}

// Points to show for a player: actual once a stat line exists, projected for those yet to play.
export const shownPoints = id => isProjected(id) ? projectedPoints(id) : playerPoints(id);

// "X leads by 3.20" while games are still to play, "X won by 3.20" once the week (or season) is done.
export function marginText(teams, diff) {
  if (Math.abs(diff) < 0.005) return 'Tied';
  const season = document.getElementById('season').value, week = document.getElementById('week').value;
  const over = week === 'all' ? String(season) !== String(state.currentSeason) : !isUpcoming(season, week);
  return `${teams[diff > 0 ? 0 : 1].name} ${over ? 'won' : 'leads'} by ${Math.abs(diff).toFixed(2)}`;
}
