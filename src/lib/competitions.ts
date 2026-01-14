// Competition configuration data
export interface CompetitionConfig {
  key: string;
  name: string;
  shortName: string;
  description: string;
  format: 'single_elimination' | 'series_bracket';
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
    key: 'nfl_playoffs',
    name: 'NFL Playoffs',
    shortName: 'NFL',
    description: 'Single-elimination bracket with 14 teams',
    format: 'single_elimination',
    captureEnabled: true,
    defaultTeamsPerPlayer: 1,
    maxPlayers: 14,
    icon: '🏈',
    season: '2024-2025',
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
    season: '2024-2025',
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
    season: '2024-2025',
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
    season: '2025',
    oddsApiSportKey: 'baseball_mlb',
  },
];

export function getCompetition(key: string): CompetitionConfig | undefined {
  return COMPETITIONS.find(c => c.key === key);
}

export function getOddsApiSportKey(competitionKey: string): string | undefined {
  return COMPETITIONS.find(c => c.key === competitionKey)?.oddsApiSportKey;
}
