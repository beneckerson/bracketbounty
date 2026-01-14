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

// Demo participants - 8 players for CFP pool
export const demoParticipants: Participant[] = [
  { id: 'p1', displayName: 'Ben', initials: 'BE', venmoHandle: '@ben-edwards', isClaimed: true },
  { id: 'p2', displayName: 'Sean', initials: 'SE', avatarUrl: 'https://i.pravatar.cc/150?u=sean', venmoHandle: '@seanm', isClaimed: true },
  { id: 'p3', displayName: 'Rich', initials: 'RL', venmoHandle: '@richlee', isClaimed: true },
  { id: 'p4', displayName: 'Johnson', initials: 'JO', avatarUrl: 'https://i.pravatar.cc/150?u=johnson', isClaimed: true },
  { id: 'p5', displayName: 'Skilone', initials: 'SK', avatarUrl: 'https://i.pravatar.cc/150?u=skilone', venmoHandle: '@skilone', isClaimed: true },
  { id: 'p6', displayName: 'JMB', initials: 'JM', avatarUrl: 'https://i.pravatar.cc/150?u=jmb', isClaimed: true },
  { id: 'p7', displayName: 'B Hart', initials: 'BH', venmoHandle: '@bhart', isClaimed: true },
  { id: 'p8', displayName: 'Kool', initials: 'KO', avatarUrl: 'https://i.pravatar.cc/150?u=kool', venmoHandle: '@kool', isClaimed: true },
];

// Demo teams for CFP - using actual 2026 CFP teams with correct seeds and colors
export const cfpTeams: Team[] = [
  { code: 'IND', name: 'Indiana', abbreviation: 'IND', seed: 1, color: 'team-crimson' },
  { code: 'OSU', name: 'Ohio State', abbreviation: 'OSU', seed: 2, color: 'team-scarlet' },
  { code: 'UGA', name: 'Georgia', abbreviation: 'UGA', seed: 3, color: 'team-red' },
  { code: 'TTU', name: 'Texas Tech', abbreviation: 'TTU', seed: 4, color: 'team-red' },
  { code: 'ORE', name: 'Oregon', abbreviation: 'ORE', seed: 5, color: 'team-green' },
  { code: 'MISS', name: 'Ole Miss', abbreviation: 'MISS', seed: 6, color: 'team-navy' },
  { code: 'BAMA', name: 'Alabama', abbreviation: 'BAMA', seed: 9, color: 'team-crimson' },
  { code: 'MIAMI', name: 'Miami', abbreviation: 'MIAMI', seed: 10, color: 'team-orange' },
];

// Helper to get team by code
function getTeam(code: string): Team {
  return cfpTeams.find(t => t.code === code)!;
}

// Demo pool with capture mode showing real 2026 CFP results
// Capture Mode with ATS scoring:
// - The participant whose team COVERS the spread wins the matchup
// - Winner captures ALL teams from the losing participant
// - "CAPTURED" chip shown when underdog covers (upset in ATS terms)
export const demoCapturePool: Pool = {
  id: 'pool-1',
  name: "Gamblin' Boys 2026 CFP",
  competitionKey: 'cfp',
  season: '2025-2026',
  mode: 'capture',
  scoringRule: 'ats',
  status: 'active',
  buyinAmountCents: 5000,
  currency: 'USD',
  maxPlayers: 8,
  teamsPerPlayer: 1,
  allocationMethod: 'random',
  inviteCode: 'GBCFP26',
  createdBy: 'p1',
  members: [
    // Ben → IND - Covered in QF, covered in SF → Still Active with IND
    { id: 'm1', participant: demoParticipants[0], role: 'creator', ownedTeams: [
      { teamCode: 'IND', acquiredVia: 'initial', acquiredAt: new Date('2025-12-15') },
    ]},
    // Sean → OSU - Failed to cover in QF vs Miami → Eliminated
    { id: 'm2', participant: demoParticipants[1], role: 'member', ownedTeams: [] },
    // Rich → UGA - Failed to cover in QF vs Ole Miss → Eliminated
    { id: 'm3', participant: demoParticipants[2], role: 'member', ownedTeams: [] },
    // Johnson → TTU - Failed to cover in QF vs Oregon → Eliminated
    { id: 'm4', participant: demoParticipants[3], role: 'member', ownedTeams: [] },
    // Skilone → ORE - Covered in QF, failed to cover in SF vs Indiana → Eliminated
    { id: 'm5', participant: demoParticipants[4], role: 'member', ownedTeams: [] },
    // JMB → MISS - Covered (captured) in QF, failed to cover in SF vs Miami → Eliminated
    { id: 'm6', participant: demoParticipants[5], role: 'member', ownedTeams: [] },
    // B Hart → BAMA - Failed to cover in QF vs Indiana → Eliminated
    { id: 'm7', participant: demoParticipants[6], role: 'member', ownedTeams: [] },
    // Kool → MIAMI - Covered (captured) in QF, covered (captured) in SF → Still Active with MIAMI
    { id: 'm8', participant: demoParticipants[7], role: 'member', ownedTeams: [
      { teamCode: 'MIAMI', acquiredVia: 'initial', acquiredAt: new Date('2025-12-15') },
    ]},
  ],
  rounds: [
    {
      id: 'round-qf',
      key: 'quarterfinals',
      name: 'Quarterfinals',
      order: 1,
      matchups: [
        {
          // QF-1: (10) MIAMI +9.5 vs (2) OHIO STATE -9.5
          // Result: MIAMI 24 - OSU 14 (Miami wins by 10, covers +9.5 as underdog)
          // Outcome: Kool (MIAMI) covers as underdog → CAPTURED chip shown, Kool retains MIAMI
          id: 'match-qf-1',
          roundId: 'round-qf',
          eventId: 'evt-1',
          teamA: { team: getTeam('MIAMI'), ownerId: 'm8', score: 24, spread: 9.5 },
          teamB: { team: getTeam('OSU'), ownerId: 'm2', score: 14, spread: -9.5 },
          status: 'final',
          winnerId: 'm8',
          winnerTeamCode: 'MIAMI',
          capturedTeams: ['OSU'],
          decidedBy: 'ats',
        },
        {
          // QF-2: (5) OREGON -2.5 vs (4) TEXAS TECH +2.5
          // Result: ORE 23 - TTU 0 (Oregon wins by 23, covers -2.5 as favorite)
          // Outcome: Skilone (ORE) covers as favorite → No CAPTURED chip, Skilone retains ORE
          id: 'match-qf-2',
          roundId: 'round-qf',
          eventId: 'evt-2',
          teamA: { team: getTeam('ORE'), ownerId: 'm5', score: 23, spread: -2.5 },
          teamB: { team: getTeam('TTU'), ownerId: 'm4', score: 0, spread: 2.5 },
          status: 'final',
          winnerId: 'm5',
          winnerTeamCode: 'ORE',
          capturedTeams: ['TTU'],
          decidedBy: 'ats',
        },
        {
          // QF-3: (1) INDIANA -7.0 vs (9) ALABAMA +7.0
          // Result: IND 38 - BAMA 3 (Indiana wins by 35, covers -7.0 as favorite)
          // Outcome: Ben (IND) covers as favorite → No CAPTURED chip, Ben retains IND
          id: 'match-qf-3',
          roundId: 'round-qf',
          eventId: 'evt-3',
          teamA: { team: getTeam('IND'), ownerId: 'm1', score: 38, spread: -7.0 },
          teamB: { team: getTeam('BAMA'), ownerId: 'm7', score: 3, spread: 7.0 },
          status: 'final',
          winnerId: 'm1',
          winnerTeamCode: 'IND',
          capturedTeams: ['BAMA'],
          decidedBy: 'ats',
        },
        {
          // QF-4: (6) OLE MISS +6.5 vs (3) GEORGIA -6.5
          // Result: MISS 39 - UGA 34 (Ole Miss wins by 5, covers +6.5 as underdog)
          // Outcome: JMB (MISS) covers as underdog → CAPTURED chip shown, JMB retains MISS
          id: 'match-qf-4',
          roundId: 'round-qf',
          eventId: 'evt-4',
          teamA: { team: getTeam('MISS'), ownerId: 'm6', score: 39, spread: 6.5 },
          teamB: { team: getTeam('UGA'), ownerId: 'm3', score: 34, spread: -6.5 },
          status: 'final',
          winnerId: 'm6',
          winnerTeamCode: 'MISS',
          capturedTeams: ['UGA'],
          decidedBy: 'ats',
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
          // SF-1: (10) MIAMI -3.5 vs (6) OLE MISS +3.5
          // Result: MIAMI 31 - MISS 27 (Miami wins by 4, covers -3.5 as favorite)
          // But Miami is the lower seed playing as favorite → CAPTURED chip shown
          // Outcome: Kool (MIAMI) covers, retains MIAMI
          id: 'match-sf-1',
          roundId: 'round-sf',
          eventId: 'evt-5',
          teamA: { team: getTeam('MIAMI'), ownerId: 'm8', score: 31, spread: -3.5 },
          teamB: { team: getTeam('MISS'), ownerId: 'm6', score: 27, spread: 3.5 },
          status: 'final',
          winnerId: 'm8',
          winnerTeamCode: 'MIAMI',
          capturedTeams: ['MISS'],
          decidedBy: 'ats',
        },
        {
          // SF-2: (1) INDIANA -3.5 vs (5) OREGON +3.5
          // Result: IND 56 - ORE 22 (Indiana wins by 34, covers -3.5 as favorite)
          // Outcome: Ben (IND) covers as favorite → No CAPTURED chip, Ben retains IND
          id: 'match-sf-2',
          roundId: 'round-sf',
          eventId: 'evt-6',
          teamA: { team: getTeam('IND'), ownerId: 'm1', score: 56, spread: -3.5 },
          teamB: { team: getTeam('ORE'), ownerId: 'm5', score: 22, spread: 3.5 },
          status: 'final',
          winnerId: 'm1',
          winnerTeamCode: 'IND',
          capturedTeams: ['ORE'],
          decidedBy: 'ats',
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
          // Final: (1) INDIANA -7.5 vs (10) MIAMI +7.5
          // Status: Upcoming
          id: 'match-final',
          roundId: 'round-final',
          eventId: 'evt-7',
          teamA: { team: getTeam('IND'), ownerId: 'm1', spread: -7.5 },
          teamB: { team: getTeam('MIAMI'), ownerId: 'm8', spread: 7.5 },
          status: 'upcoming',
          startTime: new Date('2026-01-20T20:00:00'),
        },
      ],
    },
  ],
};

// Audit log for capture events (ATS-based)
export const demoAuditLog: AuditLogEntry[] = [
  {
    id: 'log-1',
    poolId: 'pool-1',
    actorName: 'System',
    actionType: 'capture',
    description: 'Miami (+9.5) won outright, covering the spread. Kool captured Ohio State from Sean.',
    createdAt: new Date('2025-12-31T20:00:00'),
  },
  {
    id: 'log-2',
    poolId: 'pool-1',
    actorName: 'System',
    actionType: 'capture',
    description: 'Oregon (-2.5) covered the spread. Skilone captured Texas Tech from Johnson.',
    createdAt: new Date('2025-12-31T23:30:00'),
  },
  {
    id: 'log-3',
    poolId: 'pool-1',
    actorName: 'System',
    actionType: 'capture',
    description: 'Indiana (-7.0) covered the spread. Ben captured Alabama from B Hart.',
    createdAt: new Date('2026-01-01T17:00:00'),
  },
  {
    id: 'log-4',
    poolId: 'pool-1',
    actorName: 'System',
    actionType: 'capture',
    description: 'Ole Miss (+6.5) won outright, covering the spread. JMB captured Georgia from Rich.',
    createdAt: new Date('2026-01-01T20:30:00'),
  },
  {
    id: 'log-5',
    poolId: 'pool-1',
    actorName: 'System',
    actionType: 'capture',
    description: 'Miami (-3.5) covered the spread. Kool captured Ole Miss from JMB.',
    createdAt: new Date('2026-01-09T20:00:00'),
  },
  {
    id: 'log-6',
    poolId: 'pool-1',
    actorName: 'System',
    actionType: 'capture',
    description: 'Indiana (-3.5) covered the spread. Ben captured Oregon from Skilone.',
    createdAt: new Date('2026-01-09T23:30:00'),
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
