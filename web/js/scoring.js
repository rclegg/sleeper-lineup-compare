import { state } from './state.js';

const round2 = n => Math.round(n * 100) / 100;

// Points for one stat line under the league's scoring settings.
function points(statLine) {
  if (!statLine) return 0;
  let total = 0;
  for (const key in state.scoring) {
    if (statLine[key] != null) total += statLine[key] * state.scoring[key];
  }
  return round2(total);
}

// A player's points for the loaded stats, or null if nothing is loaded yet.
export function playerPoints(id) {
  const { stats } = state;
  if (!stats) return null;
  if (Array.isArray(stats)) return round2(stats.reduce((sum, week) => sum + points(week[id]), 0));
  return points(stats[id]);
}
