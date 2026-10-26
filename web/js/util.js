export const $ = id => document.getElementById(id);

export function status(text, isError) {
  const el = $('status');
  el.textContent = text;
  el.className = 'status' + (isError ? ' err' : '');
}

export function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
