import { state } from './state.js';
import { $ } from './util.js';
import { save, load } from './storage.js';

const round2 = n => Math.round(n * 100) / 100;

// Points for one stat line under the league's scoring settings.
export function points(statLine) {
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

// Standard scoring in Sleeper's stat keys; PPR variants only change the per-reception value.
const BASE = {
  pass_yd: 0.04, pass_td: 4, pass_int: -2, pass_2pt: 2, rush_yd: 0.1, rush_td: 6, rush_2pt: 2,
  rec_yd: 0.1, rec_td: 6, rec_2pt: 2, fum_lost: -2, fum_rec_td: 6,
  xpm: 1, xpmiss: -1, fgm_0_19: 3, fgm_20_29: 3, fgm_30_39: 3, fgm_40_49: 4, fgm_50_59: 5, fgm_60p: 5,
  def_td: 6, def_st_td: 6, int: 2, sack: 1, ff: 1, fum_rec: 2, safe: 2, blk_kick: 2,
  pts_allow_0: 10, pts_allow_1_6: 7, pts_allow_7_13: 4, pts_allow_14_20: 1, pts_allow_21_27: 0, pts_allow_28_34: -1, pts_allow_35p: -4,
};
const PRESETS = { std: 0, half: 0.5, ppr: 1 };
const CHOICES = [['league', 'My league'], ['std', 'Standard'], ['half', 'Half PPR'], ['ppr', 'PPR']];

let chosen = 'league';

export function setScoringChoice(c) { if (c === 'league' || c in PRESETS) chosen = c; }
export const scoringChoice = () => chosen;

// Sets state.scoring from the selector: the league's rules, or a preset (also used when there is no league).
export function applyScoring() {
  const has = !!state.leagueScoring;
  const c = chosen === 'league' && !has ? 'ppr' : chosen;
  state.scoring = c === 'league' ? state.leagueScoring : { ...BASE, rec: PRESETS[c] };
  const sel = $('scoring');
  sel.value = c;
  sel.querySelector('option[value="league"]').disabled = !has;
}

// onChange re-renders: points are computed from the loaded stats, so no new request is needed.
export function initScoring(onChange) {
  const sel = $('scoring');
  sel.innerHTML = CHOICES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  setScoringChoice(load('prefs', {}).scoring);
  sel.addEventListener('change', () => {
    chosen = sel.value;
    save('prefs', { ...load('prefs', {}), scoring: chosen });
    applyScoring();
    onChange();
  });
}
