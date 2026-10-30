// "Save image": draws the current matchup onto a plain canvas and downloads it as a PNG.
import { $, status } from './util.js';
import { state } from './state.js';
import { playerPoints } from './scoring.js';
import { marginText } from './projections.js';
import { POS } from './players.js';

const W = 900, PAD = 32, ROW = 34;
const FONT = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';

// Theme colors come from the page's CSS variables so the image matches light or dark.
function palette() {
  const cs = getComputedStyle(document.documentElement);
  const v = n => cs.getPropertyValue(n).trim();
  return { bg: v('--card'), fg: v('--fg'), mute: v('--mute'), line: v('--line'), a: v('--a'), b: v('--b'), win: v('--win'), accent: v('--accent'), on: v('--on-accent') };
}

function lineup(ids) {
  return [...ids].sort((x, y) => {
    const px = state.players[x] || {}, py = state.players[y] || {};
    return (POS.indexOf(px.p) + 1 || 99) - (POS.indexOf(py.p) + 1 || 99) || (playerPoints(y) || 0) - (playerPoints(x) || 0);
  });
}

function fit(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  while (text.length > 1 && ctx.measureText(text + '…').width > max) text = text.slice(0, -1);
  return text + '…';
}

export function drawMatchup() {
  const c = palette();
  const n = Math.max(...state.teams.map(t => t.ids.length));
  const H = 190 + n * ROW + 56;
  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = W * scale; canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);

  const totals = state.teams.map(t => t.ids.reduce((s, id) => s + (playerPoints(id) || 0), 0));
  const scored = !!state.stats;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = c.fg; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'left';
  ctx.fillText('Sleeper Lineup Compare', PAD, 20 + PAD / 2 + 8);
  ctx.fillStyle = c.mute; ctx.font = `13px ${FONT}`; ctx.textAlign = 'right';
  const wk = $('week').value === 'all' ? 'Season total' : 'Week ' + $('week').value;
  ctx.fillText(`${$('season').value} · ${wk}`, W - PAD, 20 + PAD / 2 + 8);

  const colW = (W - PAD * 2 - 24) / 2;
  state.teams.forEach((team, i) => {
    const x = PAD + i * (colW + 24), color = i ? c.b : c.a;
    const leading = scored && team.ids.length && totals[i] > totals[1 - i];
    ctx.fillStyle = leading ? c.win : 'transparent';
    if (leading) { ctx.beginPath(); ctx.roundRect(x - 10, 66, colW + 20, H - 66 - 28, 12); ctx.fill(); }
    ctx.textAlign = 'left';
    ctx.fillStyle = c.fg; ctx.font = `700 18px ${FONT}`;
    ctx.fillText(fit(ctx, team.name, colW - (leading ? 90 : 0)), x, 96);
    if (leading) {
      ctx.fillStyle = c.accent; ctx.beginPath(); ctx.roundRect(x + colW - 72, 80, 72, 22, 11); ctx.fill();
      ctx.fillStyle = c.on; ctx.font = `800 11px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText(marginText(state.teams, 1).includes(' won ') ? 'WON' : 'LEADING', x + colW - 36, 95);
      ctx.textAlign = 'left';
    }
    ctx.fillStyle = color; ctx.fillRect(x, 104, colW, 2);
    ctx.font = `700 44px ${FONT}`;
    ctx.fillText(scored ? totals[i].toFixed(2) : '–', x, 154);
    lineup(team.ids).forEach((id, r) => {
      const p = state.players[id] || { n: id, p: '' };
      const y = 178 + r * ROW;
      ctx.fillStyle = c.line; ctx.fillRect(x, y - 10, colW, 1);
      ctx.fillStyle = color; ctx.font = `800 11px ${FONT}`;
      ctx.fillText(p.p || '', x, y + 14);
      ctx.fillStyle = c.fg; ctx.font = `15px ${FONT}`;
      ctx.fillText(fit(ctx, p.n + (p.t ? ' ' + p.t : ''), colW - 130), x + 44, y + 14);
      const pts = playerPoints(id);
      ctx.textAlign = 'right'; ctx.font = `600 15px ${FONT}`;
      ctx.fillText(pts == null ? '–' : pts.toFixed(2), x + colW, y + 14);
      ctx.textAlign = 'left';
    });
  });

  ctx.textAlign = 'center'; ctx.fillStyle = c.mute; ctx.font = `13px ${FONT}`;
  const diff = totals[0] - totals[1];
  const verdict = scored && state.teams.every(t => t.ids.length)
    ? marginText(state.teams, diff) : '';
  ctx.fillStyle = c.fg; ctx.font = `600 14px ${FONT}`;
  ctx.fillText(verdict, W / 2, 44);
  return canvas;
}

export function initImage() {
  $('saveimg').addEventListener('click', () => {
    try {
      drawMatchup().toBlob(blob => {
        if (!blob) { status('Could not make the image.', true); return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'lineup-compare.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        status('Image saved.');
      }, 'image/png');
    } catch (e) {
      status('Could not make the image: ' + e.message, true);
    }
  });
}
