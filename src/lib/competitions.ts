// Competition configuration data
export interface CompetitionConfig {
  key: string;
  name: string;
  shortName: string;
  description: string;
  format: 'single_elimination' | 'series_bracket' | 'field_event';
  captureEnabled: boolean;
  defaultTeamsPerPlayer: number;
  maxPlayers: number;
  icon: string;
  season: string;
  // The Odds API sport key for fetching lines
  oddsApiSportKey: string;
}

export const COMPETITIONS: CompetitionConfig[] = [
  {
    key: 'cfp',
    name: 'College Football Playoff',
    shortName: 'CFP',
    description: '12-team single-elimination bracket',
    format: 'single_elimination',
    captureEnabled: true,
    defaultTeamsPerPlayer: 1,
    maxPlayers: 12,
    icon: '🏈',
    season: '2025-2026',
    oddsApiSportKey: 'americanfootball_ncaaf',
  },
  {
    key: 'nfl_playoffs',
    name: 'NFL Playoffs',
    shortName: 'NFL',
    description: 'Single-elimination bracket with 14 teams',
    format: 'single_elimination',
    captureEnabled: true,
    defaultTeamsPerPlayer: 1,
    maxPlayers: 14,
    icon: '🏈',
    season: '2025-2026',
    oddsApiSportKey: 'americanfootball_nfl',
  },
  {
    key: 'nba_playoffs',
    name: 'NBA Playoffs',
    shortName: 'NBA',
    description: 'Best-of-7 series bracket with 16 teams',
    format: 'series_bracket',
    captureEnabled: true,
    defaultTeamsPerPlayer: 1,
    maxPlayers: 16,
    icon: '🏀',
    season: '2025-2026',
    oddsApiSportKey: 'basketball_nba',
  },
  {
    key: 'nhl_playoffs',
    name: 'NHL Playoffs',
    shortName: 'NHL',
    description: 'Best-of-7 series bracket with 16 teams',
    format: 'series_bracket',
    captureEnabled: true,
    defaultTeamsPerPlayer: 1,
    maxPlayers: 16,
    icon: '🏒',
    season: '2025-2026',
    oddsApiSportKey: 'icehockey_nhl',
  },
  {
    key: 'mlb_playoffs',
    name: 'MLB Playoffs',
    shortName: 'MLB',
    description: 'Mixed format with Wild Card and series rounds',
    format: 'series_bracket',
    captureEnabled: true,
    defaultTeamsPerPlayer: 1,
    maxPlayers: 12,
    icon: '⚾',
    season: '2026',
    oddsApiSportKey: 'baseball_mlb',
  },
  {
    key: 'kentucky_derby',
    name: 'Kentucky Derby',
    shortName: 'Derby',
    description: 'Winner-take-all horse racing pool. Each player owns horses; the owner of the winning horse wins the pot.',
    format: 'field_event',
    captureEnabled: false,
    defaultTeamsPerPlayer: 1,
    maxPlayers: 20,
    icon: '🐎',
    season: '2026',
    oddsApiSportKey: '',
  },
  {
    key: 'march_madness',
    name: 'NCAA Tournament',
    shortName: 'NCAAT',
    description: '64-team single-elimination bracket with First Four play-ins',
    format: 'single_elimination',
    captureEnabled: true,
    defaultTeamsPerPlayer: 1,
    maxPlayers: 64,
    icon: '🏀',
    season: '2025-2026',
    oddsApiSportKey: 'basketball_ncaab',
  },
];

export function getCompetition(key: string): CompetitionConfig | undefined {
  return COMPETITIONS.find(c => c.key === key);
}

export function getOddsApiSportKey(competitionKey: string): string | undefined {
  return COMPETITIONS.find(c => c.key === competitionKey)?.oddsApiSportKey;
}
