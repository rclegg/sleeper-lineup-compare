import { load } from './storage.js';

// Shared mutable state, imported by the other modules.
export const state = {
  players: {},   // id -> { n: name, p: position, t: team }
  index: [],     // searchable list built from players
  scoring: {},   // the chosen league's scoring_settings
  stats: null,   // one week's stats keyed by player id, an array of those for "all weeks", or null before scoring
  teams: load('teams', [{ name: 'Team A', ids: [] }, { name: 'Team B', ids: [] }]),
  leagueId: '',
  currentSeason: '',  // from /state/nfl, used to cap "all weeks" at the weeks played so far
  currentWeek: 0,
};
