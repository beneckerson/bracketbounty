// Core types for BracketBounty

export type PoolMode = 'capture' | 'standard';
export type ScoringRule = 'straight' | 'ats';
export type AllocationMethod = 'random' | 'draft';
export type EventType = 'game' | 'series';
export type EventStatus = 'upcoming' | 'live' | 'final';
export type MemberRole = 'creator' | 'member';

export interface Team {
  code: string;
  name: string;
  abbreviation: string;
  seed: number;
  color: string;
}

export interface Participant {
  id: string;
  displayName: string;
  avatarUrl?: string;
  initials: string;
  venmoHandle?: string;
  isClaimed: boolean;
}

export interface OwnedTeam {
  teamCode: string;
  acquiredVia: 'initial' | 'capture';
  fromMatchupId?: string;
  acquiredAt: Date;
}

export interface PoolMember {
  id: string;
  participant: Participant;
  role: MemberRole;
  ownedTeams: OwnedTeam[];
}

export interface MatchupTeamEntry {
  team: Team;
  ownerId: string;
  score?: number;
  seriesWins?: number;
}

export interface Matchup {
  id: string;
  roundId: string;
  eventId: string;
  teamA: MatchupTeamEntry;
  teamB: MatchupTeamEntry;
  status: EventStatus;
  winnerId?: string;
  winnerTeamCode?: string;
  capturedTeams?: string[];
  decidedBy?: 'straight' | 'ats' | 'manual';
  commissionerNote?: string;
  startTime?: Date;
  bestOf?: number;
}

export interface Round {
  id: string;
  key: string;
  name: string;
  order: number;
  matchups: Matchup[];
}

export interface Pool {
  id: string;
  name: string;
  competitionKey: string;
  season: string;
  mode: PoolMode;
  scoringRule: ScoringRule;
  status: 'lobby' | 'active' | 'completed';
  buyinAmountCents: number;
  currency: string;
  maxPlayers: number;
  teamsPerPlayer: number;
  allocationMethod: AllocationMethod;
  inviteCode: string;
  createdBy: string;
  members: PoolMember[];
  rounds: Round[];
}

export interface CompetitionConfig {
  key: string;
  name: string;
  format: 'single_elimination' | 'series_bracket' | 'hybrid';
  captureEnabled: boolean;
  captureDefault: boolean;
  atsEnabled: boolean;
  rounds: RoundConfig[];
}

export interface RoundConfig {
  key: string;
  name: string;
  order: number;
  eventType: EventType;
  bestOf?: number;
}

export interface AuditLogEntry {
  id: string;
  poolId: string;
  actorName: string;
  actionType: string;
  description: string;
  createdAt: Date;
}
