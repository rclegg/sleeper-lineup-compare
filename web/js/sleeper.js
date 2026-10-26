// Public Sleeper API (no auth).
const API = 'https://api.sleeper.app/v1';

export async function get(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error('Sleeper returned ' + res.status);
  return res.json();
}
