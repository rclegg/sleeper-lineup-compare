// Renders the two team columns and handles lineup editing (rename, search, add, remove).
import { $, esc } from './util.js';
import { state } from './state.js';
import { save } from './storage.js';
import { POS } from './players.js';
import { playerPoints } from './scoring.js';
import { benchHtml, initBench } from './bench.js';
import { projectedPoints } from './projections.js';
import { lookupRoster, applyMember } from './roster.js';
import { weekStarters } from './members.js';

const MAX_RESULTS = 12;

// Projected points when the week is unplayed and projections loaded, else actual points.
const shownPoints = id => state.proj ? projectedPoints(id) : playerPoints(id);

// Bolds the matched part of a search result name.
function highlight(name, query) {
  const at = name.toLowerCase().indexOf(query);
  if (at < 0) return esc(name);
  return esc(name.slice(0, at)) + '<mark>' + esc(name.slice(at, at + query.length)) + '</mark>' + esc(name.slice(at + query.length));
}

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
      || (shownPoints(y) || 0) - (shownPoints(x) || 0)
      || String(px.n).localeCompare(py.n);
  });
}

function playerRow(teamIndex, id) {
  const p = state.players[id] || { n: id, p: '', t: '' };
  const pts = shownPoints(id);
  return `<tr><td><div class="who"><img class="av" src="${avatarUrl(id, p)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`
    + `<span class="pos ${p.p}">${p.p}</span><span>${esc(p.n)} <small style="color:var(--mute)">${p.t}</small></span></div></td>`
    + `<td class="pts${state.proj ? ' proj' : ''}">${pts == null ? '–' : pts.toFixed(2)}${state.proj ? '<small class="tag">proj</small>' : ''}</td>`
    + `<td class="x"><button data-t="${teamIndex}" data-id="${id}" aria-label="Remove ${esc(p.n)}">×</button></td></tr>`;
}

function teamColumn(team, i, totals) {
  const col = document.createElement('div');
  col.className = 'team';
  col.style.setProperty('--c', i ? 'var(--b)' : 'var(--a)');
  if ((state.stats || state.proj) && team.ids.length && totals[i] > totals[1 - i]) col.classList.add('win');

  const missing = POS.filter(pos => !team.ids.some(id => (state.players[id] || {}).p === pos));
  const hint = team.ids.length && missing.length ? `<div class="hint">Not added yet: ${missing.join(' · ')}</div>` : '';
  const rows = sortedLineup(team.ids).map(id => playerRow(i, id)).join('');

  const fill = state.members.length
    ? `<select class="fill" data-fill="${i}" aria-label="Fill team ${'AB'[i]} from a league manager"><option value="">Fill from a league manager…</option>`
      + state.members.map(m => `<option value="${m.rosterId}">${esc(m.name)}${m.owner && m.owner !== m.name ? ' (' + esc(m.owner) + ')' : ''}</option>`).join('') + '</select>'
    : '';
  col.innerHTML = `<h2><input value="${esc(team.name)}" data-name="${i}" aria-label="Team ${'AB'[i]} name"></h2>
      ${fill}
      <div class="total">${state.stats || state.proj ? totals[i].toFixed(2) : '–'}${state.proj ? '<small class="tag">projected</small>' : ''}</div>
      <div class="search"><input placeholder="Add player…" data-s="${i}" aria-label="Search players to add to team ${'AB'[i]}" autocomplete="off"><div class="results" hidden></div></div>
      ${rows ? `<table>${rows}</table>${hint}` : '<div class="empty">No players yet.<br>Search above to add, or type a Sleeper username as the team name.</div>'}
      ${benchHtml(team, i)}`;
  return col;
}

export function render() {
  const { teams, stats } = state;
  const cols = $('cols');
  cols.innerHTML = '';
  const totals = teams.map(t => t.ids.reduce((sum, id) => sum + (shownPoints(id) || 0), 0));
  teams.forEach((team, i) => cols.appendChild(teamColumn(team, i, totals)));

  const verdict = $('verdict');
  if ((stats || state.proj) && teams.every(t => t.ids.length)) {
    const diff = totals[0] - totals[1];
    verdict.textContent = Math.abs(diff) < 0.005 ? 'Tied.' : `${teams[diff > 0 ? 0 : 1].name} leads by ${Math.abs(diff).toFixed(2)}${state.proj ? ' (projected)' : ''}`;
  } else {
    verdict.textContent = '';
  }
}

export function initTeamEditing() {
  const persist = () => { save('teams', state.teams); render(); };
  initBench(persist);

  $('cols').addEventListener('click', e => {
    const remove = e.target.closest('button[data-id]');
    if (remove) {
      const team = state.teams[+remove.dataset.t];
      team.ids = team.ids.filter(x => x !== remove.dataset.id);
      persist();
      return;
    }
    const result = e.target.closest('.results div[data-id]');
    if (result) addPlayer(+result.dataset.t, result.dataset.id);
  });

  $('cols').addEventListener('change', async e => {
    if (e.target.dataset.fill == null || !e.target.value) return;
    const member = state.members.find(m => String(m.rosterId) === e.target.value);
    if (member) {
      const starters = await weekStarters(state.leagueId, member.rosterId, member.starters, $('season').value, $('week').value);
      applyMember(+e.target.dataset.fill, { ...member, starters }, true);
    }
    render();
  });

  // Adds a player, then puts the cursor back in that team's search box for the next one.
  function addPlayer(t, id) {
    const team = state.teams[t];
    if (!team.ids.includes(id)) team.ids.push(id);
    persist();
    const box = document.querySelector(`[data-s="${t}"]`);
    if (box) box.focus();
  }

  // Arrow keys move through search results, Enter adds, Escape closes.
  $('cols').addEventListener('keydown', e => {
    const input = e.target;
    if (input.dataset.s == null) return;
    const box = input.nextElementSibling;
    const items = [...box.querySelectorAll('div[data-id]')];
    const current = items.findIndex(x => x.classList.contains('active'));
    if (e.key === 'Escape') { box.hidden = true; return; }
    if (box.hidden || !items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (current + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((x, k) => x.classList.toggle('active', k === next));
      items[next].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = items[current < 0 ? 0 : current];
      addPlayer(+pick.dataset.t, pick.dataset.id);
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
      .map(p => `<div data-id="${p.id}" data-t="${searchIndex}"><span>${highlight(p.n, query)}</span><small>${p.p} ${p.t}</small></div>`)
      .join('') || '<div>No match</div>';
    box.hidden = false;
  });

  // Clicking anywhere outside a search box closes any open result list.
  document.addEventListener('click', e => {
    if (!e.target.closest('.search')) document.querySelectorAll('.results').forEach(r => { r.hidden = true; });
  });
}
