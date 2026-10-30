// Renders the two team columns and handles lineup editing (rename, search, add, remove).
import { $, esc } from './util.js';
import { state } from './state.js';
import { save } from './storage.js';
import { POS } from './players.js';
import { playerPoints } from './scoring.js';
import { lookupRoster } from './roster.js';

const MAX_RESULTS = 12;

function avatarUrl(id, p) {
  return p.p === 'DEF'
    ? 'https://sleepercdn.com/images/team_logos/nfl/' + String(p.t || id).toLowerCase() + '.png'
    : 'https://sleepercdn.com/content/nfl/players/thumb/' + id + '.jpg';
}

// Display order is fixed by position (then points, then name), whatever order players were added.
function sortedLineup(ids) {
  const { players } = state;
  return [...ids].sort((x, y) => {
    const px = players[x] || {}, py = players[y] || {};
    return (POS.indexOf(px.p) + 1 || 99) - (POS.indexOf(py.p) + 1 || 99)
      || (playerPoints(y) || 0) - (playerPoints(x) || 0)
      || String(px.n).localeCompare(py.n);
  });
}

function playerRow(teamIndex, id) {
  const p = state.players[id] || { n: id, p: '', t: '' };
  const pts = playerPoints(id);
  return `<tr><td><div class="who"><img class="av" src="${avatarUrl(id, p)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`
    + `<span class="pos ${p.p}">${p.p}</span><span>${esc(p.n)} <small style="color:var(--mute)">${p.t}</small></span></div></td>`
    + `<td class="pts">${pts == null ? '–' : pts.toFixed(2)}</td>`
    + `<td class="x"><button data-t="${teamIndex}" data-id="${id}" aria-label="Remove">×</button></td></tr>`;
}

function teamColumn(team, i, totals) {
  const col = document.createElement('div');
  col.className = 'team';
  col.style.setProperty('--c', i ? 'var(--b)' : 'var(--a)');
  if (state.stats && team.ids.length && totals[i] > totals[1 - i]) col.classList.add('win');

  const missing = POS.filter(pos => !team.ids.some(id => (state.players[id] || {}).p === pos));
  const hint = team.ids.length && missing.length ? `<div class="hint">Not added yet: ${missing.join(' · ')}</div>` : '';
  const rows = sortedLineup(team.ids).map(id => playerRow(i, id)).join('');

  col.innerHTML = `<h2><input value="${esc(team.name)}" data-name="${i}" aria-label="Team name"></h2>
      <div class="total">${state.stats ? totals[i].toFixed(2) : '–'}</div>
      <div class="search"><input placeholder="Add player…" data-s="${i}"><div class="results" hidden></div></div>
      ${rows ? `<table>${rows}</table>${hint}` : '<div class="empty">No players yet. Search above to add.</div>'}`;
  return col;
}

export function render() {
  const { teams, stats } = state;
  const cols = $('cols');
  cols.innerHTML = '';
  const totals = teams.map(t => t.ids.reduce((sum, id) => sum + (playerPoints(id) || 0), 0));
  teams.forEach((team, i) => cols.appendChild(teamColumn(team, i, totals)));

  const verdict = $('verdict');
  if (stats && teams.every(t => t.ids.length)) {
    const diff = totals[0] - totals[1];
    verdict.textContent = Math.abs(diff) < 0.005 ? 'Tied.' : `${teams[diff > 0 ? 0 : 1].name} leads by ${Math.abs(diff).toFixed(2)}`;
  } else {
    verdict.textContent = '';
  }
}

export function initTeamEditing() {
  const persist = () => { save('teams', state.teams); render(); };

  $('cols').addEventListener('click', e => {
    const remove = e.target.closest('button[data-id]');
    if (remove) {
      const team = state.teams[+remove.dataset.t];
      team.ids = team.ids.filter(x => x !== remove.dataset.id);
      persist();
      return;
    }
    const result = e.target.closest('.results div[data-id]');
    if (result) {
      const team = state.teams[+result.dataset.t];
      if (!team.ids.includes(result.dataset.id)) team.ids.push(result.dataset.id);
      persist();
    }
  });

  $('cols').addEventListener('input', e => {
    const nameIndex = e.target.dataset.name;
    if (nameIndex != null) {
      state.teams[+nameIndex].name = e.target.value;
      save('teams', state.teams);
      lookupRoster(+nameIndex, render);
      return;
    }
    const searchIndex = e.target.dataset.s;
    if (searchIndex == null) return;
    const query = e.target.value.trim().toLowerCase();
    const box = e.target.nextElementSibling;
    if (query.length < 2) { box.hidden = true; return; }
    const hits = state.index.filter(p => p.l.includes(query)).slice(0, MAX_RESULTS);
    box.innerHTML = hits
      .map(p => `<div data-id="${p.id}" data-t="${searchIndex}"><span>${esc(p.n)}</span><small>${p.p} ${p.t}</small></div>`)
      .join('') || '<div>No match</div>';
    box.hidden = false;
  });

  // Clicking anywhere outside a search box closes any open result list.
  document.addEventListener('click', e => {
    if (!e.target.closest('.search')) document.querySelectorAll('.results').forEach(r => { r.hidden = true; });
  });
}
