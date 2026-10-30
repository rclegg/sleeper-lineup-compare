// Share links: both lineups plus season/week/league, base64-encoded into the URL hash (#d=...).
import { $, status } from './util.js';
import { state } from './state.js';

function encodeShare() {
  const data = {
    t: state.teams.map(t => ({ n: t.name, i: t.ids })),
    s: $('season').value,
    w: $('week').value,
    l: state.leagueId,
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}

// Returns the decoded share payload from the current URL, or null if absent or malformed.
export function readShared() {
  try {
    const m = location.hash.match(/^#d=(.+)$/);
    if (!m) return null;
    const data = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
    if (!data || !Array.isArray(data.t) || data.t.length !== 2) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function initShare() {
  $('share').addEventListener('click', async () => {
    const url = location.href.split('#')[0] + '#d=' + encodeURIComponent(encodeShare());
    const box = $('shareurl');
    box.value = url;
    box.hidden = false;
    box.select();
    try {
      await navigator.clipboard.writeText(url);
      status('Link copied. Send it to your friend.');
      const label = $('share').textContent;
      $('share').textContent = 'Copied ✓';
      setTimeout(() => { $('share').textContent = label; }, 1800);
    } catch (e) {
      status('Copy the link below and send it to your friend.');
    }
  });
}
