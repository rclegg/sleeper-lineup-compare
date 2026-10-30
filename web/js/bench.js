// "What if" helpers per manager-backed team: collapsible Bench and Top free agents, each with a one-tap add.
import { esc } from './util.js';
import { state } from './state.js';
import { POS } from './players.js';
import { isProjected, isUpcoming, shownPoints } from './projections.js';

const FA_LIMIT = 10;
const open = new Set();   // "t:bench" / "t:fa" sections left open across re-renders
let faPos = 'ALL';
let faCache = null;

// The league manager a team was filled from (matched by team name), or null.
const memberOf = team => {
  const n = team.name.trim().toLowerCase();
  return state.members.find(m => m.name.toLowerCase() === n || (m.owner && m.owner.toLowerCase() === n)) || null;
};

const byPoints = ids => ids.map(id => ({ id, pts: shownPoints(id) || 0 })).sort((a, b) => b.pts - a.pts);

// Unrostered players ranked by projected points for the week (actual once played); recomputed only when data changes.
function freeAgents() {
  if (!faCache || faCache.stats !== state.stats || faCache.proj !== state.proj || faCache.rostered !== state.rostered) {
    const pool = state.proj ? Object.keys(state.proj) : Object.keys(state.stats || {});
    const ids = pool.filter(id => state.players[id] && !state.rostered.has(id));
    faCache = { stats: state.stats, proj: state.proj, rostered: state.rostered, list: byPoints(ids).filter(x => x.pts > 0) };
  }
  return faCache.list;
}

function row(t, x) {
  const p = state.players[x.id] || { n: x.id, p: '', t: '' };
  return `<li><span class="pos ${p.p}">${p.p}</span><span class="bn">${esc(p.n)} <small>${p.t}</small></span>`
    + `<span class="bp">${x.pts.toFixed(2)}${isProjected(x.id) ? '<small class="tag">proj</small>' : ''}</span><button data-add="${x.id}" data-t="${t}" aria-label="Add ${esc(p.n)}">+</button></li>`;
}

function section(t, key, title, count, body) {
  return `<details class="bench" data-k="${t}:${key}"${open.has(t + ':' + key) ? ' open' : ''}><summary>${title} (${count})</summary>${body}</details>`;
}

export function benchHtml(team, t) {
  const m = memberOf(team);
  if (!m) return '';
  const inLineup = id => team.ids.includes(id);
  const bench = byPoints(m.players.filter(id => state.players[id] && !m.starters.includes(id) && !inLineup(id)));
  const out = [section(t, 'bench', 'Bench', bench.length, bench.length ? `<ul>${bench.map(x => row(t, x)).join('')}</ul>` : '<div class="empty">Nobody on the bench.</div>')];
  // Free agents are only shown for the current/upcoming week: past availability isn't something Sleeper's API gives us.
  if (state.stats && isUpcoming(document.getElementById('season').value, document.getElementById('week').value)) {
    const fa = freeAgents().filter(x => !inLineup(x.id) && (faPos === 'ALL' || (faPos === 'FLEX' ? (state.flex || ['RB', 'WR', 'TE']) : [faPos]).includes(state.players[x.id].p))).slice(0, FA_LIMIT);
    const pick = `<select class="fapos" title="FLEX: ${(state.flex || ['RB', 'WR', 'TE']).join(', ')}" aria-label="Free agent position">${['ALL', 'FLEX', ...POS].map(p => `<option${p === faPos ? ' selected' : ''}>${p}</option>`).join('')}</select>`;
    out.push(section(t, 'fa', 'Top free agents', fa.length, pick + (fa.length ? `<ul>${fa.map(x => row(t, x)).join('')}</ul>` : '<div class="empty">No scoring free agents.</div>')));
  }
  return out.join('');
}

// persist: saves the teams and re-renders, as used by manual edits.
export function initBench(persist) {
  const cols = document.getElementById('cols');
  cols.addEventListener('click', e => {
    const b = e.target.closest('button[data-add]');
    if (!b) return;
    const team = state.teams[+b.dataset.t];
    if (!team.ids.includes(b.dataset.add)) team.ids.push(b.dataset.add);
    persist();
  });
  cols.addEventListener('change', e => {
    if (!e.target.classList.contains('fapos')) return;
    faPos = e.target.value;
    persist();
  });
  // toggle doesn't bubble: capture it to remember which sections are open.
  cols.addEventListener('toggle', e => {
    const k = e.target.dataset && e.target.dataset.k;
    if (k) { if (e.target.open) open.add(k); else open.delete(k); }
  }, true);
}
