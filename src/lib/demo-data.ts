import type { Pool, Participant, Team, PoolMember, Round, Matchup, AuditLogEntry, CompetitionConfig } from './types';

// Competition Configurations
export const competitionConfigs: Record<string, CompetitionConfig> = {
  nfl_playoffs: {
    key: 'nfl_playoffs',
    name: 'NFL Playoffs',
    format: 'single_elimination',
    captureEnabled: true,
    captureDefault: true,
    atsEnabled: true,
    rounds: [
      { key: 'wildcard', name: 'Wild Card', order: 1, eventType: 'game' },
      { key: 'divisional', name: 'Divisional', order: 2, eventType: 'game' },
      { key: 'conference', name: 'Conference', order: 3, eventType: 'game' },
      { key: 'superbowl', name: 'Super Bowl', order: 4, eventType: 'game' },
    ],
  },
  nba_playoffs: {
    key: 'nba_playoffs',
    name: 'NBA Playoffs',
    format: 'series_bracket',
    captureEnabled: true,
    captureDefault: false,
    atsEnabled: false,
    rounds: [
      { key: 'first_round', name: 'First Round', order: 1, eventType: 'series', bestOf: 7 },
      { key: 'conference_semi', name: 'Conference Semis', order: 2, eventType: 'series', bestOf: 7 },
      { key: 'conference_finals', name: 'Conference Finals', order: 3, eventType: 'series', bestOf: 7 },
      { key: 'finals', name: 'NBA Finals', order: 4, eventType: 'series', bestOf: 7 },
    ],
  },
  cfp: {
    key: 'cfp',
    name: 'College Football Playoff',
    format: 'single_elimination',
    captureEnabled: true,
    captureDefault: true,
    atsEnabled: true,
    rounds: [
      { key: 'first_round', name: '1st Round', order: 1, eventType: 'game' },
      { key: 'quarterfinals', name: 'Quarterfinals', order: 2, eventType: 'game' },
      { key: 'semifinals', name: 'Semifinals', order: 3, eventType: 'game' },
      { key: 'championship', name: 'National Championship', order: 4, eventType: 'game' },
    ],
  },
};

// Demo participants with varied avatar types
export const demoParticipants: Participant[] = [
  { id: 'p1', displayName: 'Ben Edwards', initials: 'BE', avatarUrl: 'https://i.pravatar.cc/150?u=ben', venmoHandle: '@ben-edwards', isClaimed: true },
  { id: 'p2', displayName: 'Sarah Miller', initials: 'SM', avatarUrl: 'https://i.pravatar.cc/150?u=sarah', venmoHandle: '@sarahm', isClaimed: true },
  { id: 'p3', displayName: 'Jake Davidson', initials: 'JD', venmoHandle: '@jakedavidson', isClaimed: true },
  { id: 'p4', displayName: 'Mike Chen', initials: 'MC', avatarUrl: 'https://i.pravatar.cc/150?u=mike', isClaimed: false },
  { id: 'p5', displayName: 'Emily Ross', initials: 'ER', avatarUrl: 'https://i.pravatar.cc/150?u=emily', venmoHandle: '@emilyross', isClaimed: true },
  { id: 'p6', displayName: 'Chris Taylor', initials: 'CT', isClaimed: false },
  { id: 'p7', displayName: 'Jordan Lee', initials: 'JL', avatarUrl: 'https://i.pravatar.cc/150?u=jordan', venmoHandle: '@jordanlee', isClaimed: true },
  { id: 'p8', displayName: 'Alex Kim', initials: 'AK', venmoHandle: '@alexkim', isClaimed: true },
];

// Demo teams for CFP
export const cfpTeams: Team[] = [
  { code: 'IND', name: 'Indiana', abbreviation: 'IND', seed: 1, color: 'team-red' },
  { code: 'ORE', name: 'Oregon', abbreviation: 'ORE', seed: 2, color: 'team-green' },
  { code: 'BAMA', name: 'Alabama', abbreviation: 'BAMA', seed: 3, color: 'team-red' },
  { code: 'TTU', name: 'Texas Tech', abbreviation: 'TTU', seed: 4, color: 'team-red' },
  { code: 'UGA', name: 'Georgia', abbreviation: 'UGA', seed: 5, color: 'team-red' },
  { code: 'TAMU', name: 'Texas A&M', abbreviation: 'TAMU', seed: 6, color: 'team-orange' },
  { code: 'MIAMI', name: 'Miami', abbreviation: 'MIAMI', seed: 7, color: 'team-orange' },
  { code: 'OSU', name: 'Ohio State', abbreviation: 'OSU', seed: 8, color: 'team-red' },
];

// Demo pool with capture mode showing ownership changes
export const demoCapturePool: Pool = {
  id: 'pool-1',
  name: "Gamblin' Boys 2026 CFP",
  competitionKey: 'cfp',
  season: '2025-2026',
  mode: 'capture',
  scoringRule: 'straight',
  status: 'active',
  buyinAmountCents: 5000,
  currency: 'USD',
  maxPlayers: 8,
  teamsPerPlayer: 1,
  allocationMethod: 'random',
  inviteCode: 'GBCFP26',
  createdBy: 'p1',
  members: [
    { id: 'm1', participant: demoParticipants[0], role: 'creator', ownedTeams: [
      { teamCode: 'IND', acquiredVia: 'initial', acquiredAt: new Date('2025-12-15') },
      { teamCode: 'ORE', acquiredVia: 'capture', fromMatchupId: 'match-qf-1', acquiredAt: new Date('2025-12-21') },
    ]},
    { id: 'm2', participant: demoParticipants[1], role: 'member', ownedTeams: [] }, // Lost team
    { id: 'm3', participant: demoParticipants[2], role: 'member', ownedTeams: [
      { teamCode: 'BAMA', acquiredVia: 'initial', acquiredAt: new Date('2025-12-15') },
    ]},
    { id: 'm4', participant: demoParticipants[3], role: 'member', ownedTeams: [] }, // Lost team
    { id: 'm5', participant: demoParticipants[4], role: 'member', ownedTeams: [
      { teamCode: 'UGA', acquiredVia: 'initial', acquiredAt: new Date('2025-12-15') },
      { teamCode: 'MIAMI', acquiredVia: 'capture', fromMatchupId: 'match-qf-3', acquiredAt: new Date('2025-12-21') },
    ]},
    { id: 'm6', participant: demoParticipants[5], role: 'member', ownedTeams: [] }, // Lost team
    { id: 'm7', participant: demoParticipants[6], role: 'member', ownedTeams: [
      { teamCode: 'OSU', acquiredVia: 'initial', acquiredAt: new Date('2025-12-15') },
      { teamCode: 'TAMU', acquiredVia: 'capture', fromMatchupId: 'match-qf-4', acquiredAt: new Date('2025-12-21') },
    ]},
    { id: 'm8', participant: demoParticipants[7], role: 'member', ownedTeams: [] }, // Lost team
  ],
  rounds: [
    {
      id: 'round-qf',
      key: 'quarterfinals',
      name: 'Quarterfinals',
      order: 1,
      matchups: [
        {
          id: 'match-qf-1',
          roundId: 'round-qf',
          eventId: 'evt-1',
          teamA: { team: cfpTeams[0], ownerId: 'm1', score: 42 },
          teamB: { team: cfpTeams[1], ownerId: 'm2', score: 28 },
          status: 'final',
          winnerId: 'm1',
          winnerTeamCode: 'IND',
          capturedTeams: ['ORE'],
          decidedBy: 'straight',
        },
        {
          id: 'match-qf-2',
          roundId: 'round-qf',
          eventId: 'evt-2',
          teamA: { team: cfpTeams[2], ownerId: 'm3', score: 31 },
          teamB: { team: cfpTeams[3], ownerId: 'm4', score: 24 },
          status: 'final',
          winnerId: 'm3',
          winnerTeamCode: 'BAMA',
          capturedTeams: ['TTU'],
          decidedBy: 'straight',
        },
        {
          id: 'match-qf-3',
          roundId: 'round-qf',
          eventId: 'evt-3',
          teamA: { team: cfpTeams[4], ownerId: 'm5', score: 35 },
          teamB: { team: cfpTeams[5], ownerId: 'm6', score: 21 },
          status: 'final',
          winnerId: 'm5',
          winnerTeamCode: 'UGA',
          capturedTeams: ['MIAMI'],
          decidedBy: 'straight',
        },
        {
          id: 'match-qf-4',
          roundId: 'round-qf',
          eventId: 'evt-4',
          teamA: { team: cfpTeams[6], ownerId: 'm7', score: 38 },
          teamB: { team: cfpTeams[7], ownerId: 'm8', score: 27 },
          status: 'final',
          winnerId: 'm7',
          winnerTeamCode: 'OSU',
          capturedTeams: ['TAMU'],
          decidedBy: 'straight',
        },
      ],
    },
    {
      id: 'round-sf',
      key: 'semifinals',
      name: 'Semifinals',
      order: 2,
      matchups: [
        {
          id: 'match-sf-1',
          roundId: 'round-sf',
          eventId: 'evt-5',
          teamA: { team: cfpTeams[0], ownerId: 'm1', score: 28 },
          teamB: { team: cfpTeams[2], ownerId: 'm3', score: 35 },
          status: 'final',
          winnerId: 'm3',
          winnerTeamCode: 'BAMA',
          capturedTeams: ['IND', 'ORE'],
          decidedBy: 'straight',
        },
        {
          id: 'match-sf-2',
          roundId: 'round-sf',
          eventId: 'evt-6',
          teamA: { team: cfpTeams[4], ownerId: 'm5' },
          teamB: { team: cfpTeams[6], ownerId: 'm7' },
          status: 'upcoming',
          startTime: new Date('2026-01-15T20:00:00'),
        },
      ],
    },
    {
      id: 'round-final',
      key: 'championship',
      name: 'National Championship',
      order: 3,
      matchups: [
        {
          id: 'match-final',
          roundId: 'round-final',
          eventId: 'evt-7',
          teamA: { team: cfpTeams[2], ownerId: 'm3' },
          teamB: { team: { code: 'TBD', name: 'TBD', abbreviation: 'TBD', seed: 0, color: 'team-navy' }, ownerId: '' },
          status: 'upcoming',
        },
      ],
    },
  ],
};

// Audit log for capture events
export const demoAuditLog: AuditLogEntry[] = [
  {
    id: 'log-1',
    poolId: 'pool-1',
    actorName: 'System',
    actionType: 'capture',
    description: 'Ben Edwards captured Oregon from Sarah Miller',
    createdAt: new Date('2025-12-21T18:45:00'),
  },
  {
    id: 'log-2',
    poolId: 'pool-1',
    actorName: 'System',
    actionType: 'capture',
    description: 'Jake Davidson captured Texas Tech from Mike Chen',
    createdAt: new Date('2025-12-21T21:30:00'),
  },
  {
    id: 'log-3',
    poolId: 'pool-1',
    actorName: 'System',
    actionType: 'capture',
    description: 'Emily Ross captured Miami from Chris Taylor',
    createdAt: new Date('2025-12-22T15:20:00'),
  },
  {
    id: 'log-4',
    poolId: 'pool-1',
    actorName: 'System',
    actionType: 'capture',
    description: 'Jordan Lee captured Texas A&M from Alex Kim',
    createdAt: new Date('2025-12-22T19:00:00'),
  },
  {
    id: 'log-5',
    poolId: 'pool-1',
    actorName: 'System',
    actionType: 'capture',
    description: 'Jake Davidson captured Indiana and Oregon from Ben Edwards',
    createdAt: new Date('2026-01-02T22:15:00'),
  },
];

// Helper to get team by code
export function getTeamByCode(code: string): Team | undefined {
  return cfpTeams.find(t => t.code === code);
}

// Helper to get member by id
export function getMemberById(pool: Pool, memberId: string): PoolMember | undefined {
  return pool.members.find(m => m.id === memberId);
}

// Helper to get participant by member id
export function getParticipantByMemberId(pool: Pool, memberId: string): Participant | undefined {
  return pool.members.find(m => m.id === memberId)?.participant;
}
