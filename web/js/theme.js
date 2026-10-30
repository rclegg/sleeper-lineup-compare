// Light/dark/auto theme toggle and the remembered open state of the "How it works" panel.
import { $ } from './util.js';
import { load, save } from './storage.js';

const THEMES = ['auto', 'light', 'dark'];
const ICONS = { auto: '◐', light: '☀', dark: '☾' };

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  $('theme').title = 'Theme: ' + theme + ' (tap to change)';
  $('theme').textContent = ICONS[theme];
}

export function initTheme() {
  applyTheme(load('theme', 'auto'));
  $('theme').addEventListener('click', () => {
    const next = THEMES[(THEMES.indexOf(load('theme', 'auto')) + 1) % THEMES.length];
    save('theme', next);
    applyTheme(next);
  });
  $('howto').open = load('howto_open2', false);
  $('howto').addEventListener('toggle', () => save('howto_open2', $('howto').open));
}
