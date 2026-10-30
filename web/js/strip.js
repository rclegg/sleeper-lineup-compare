// Weekly matchup strip: prev/next arrows over the Week select, showing the signed-in user's opponent.
import { $ } from './util.js';
import { state } from './state.js';
import { render } from './teams.js';
import { fillMatchup } from './roster.js';
import { opponentOf } from './members.js';
import { score } from './league.js';

const WEEKS = 18;
let ticket = 0;

// Shows "Week N vs Opponent" for the picked week; hidden without a signed-in user.
export async function refreshStrip() {
  const mine = ++ticket;
  const me = state.userId && state.leagueId && state.members.find(m => m.userId === state.userId);
  $('strip').hidden = !me;
  if (!me) return;
  const week = $('week').value;
  $('wk-prev').disabled = week !== 'all' && +week <= 1;
  $('wk-next').disabled = week !== 'all' && +week >= WEEKS;
  if (week === 'all') { $('wk-label').textContent = 'Season total'; return; }
  let opponent = null;
  try { opponent = await opponentOf(me.rosterId, week); } catch (e) { /* no matchup data */ }
  if (mine === ticket) $('wk-label').textContent = `Week ${week}` + (opponent ? ' vs ' + opponent.name : ' (no matchup)');
}

// Moves the Week select by one, loads both lineups for that week, and re-scores.
async function step(dir) {
  const sel = $('week').value;
  const week = sel === 'all' ? (state.currentWeek || 1) : Math.min(WEEKS, Math.max(1, +sel + dir));
  $('week').value = week;
  await fillMatchup(render, week, String(week));
  score();
}

export function initStrip() {
  $('wk-prev').addEventListener('click', () => step(-1));
  $('wk-next').addEventListener('click', () => step(1));
}
