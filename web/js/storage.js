// localStorage helpers. Every key is prefixed "lc_"; failures (private mode, quota) fall back silently.
export function load(key, fallback) {
  try {
    const value = localStorage.getItem('lc_' + key);
    return value ? JSON.parse(value) : fallback;
  } catch (e) {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem('lc_' + key, JSON.stringify(value));
  } catch (e) { /* storage unavailable */ }
}
