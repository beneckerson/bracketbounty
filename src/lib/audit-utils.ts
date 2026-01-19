import type { AuditLogEntry } from '@/lib/types';

interface AuditPayload {
  // pool_started
  teams_count?: number;
  members_count?: number;
  
  // member_joined
  display_name?: string;
  
  // teams_assigned
  count?: number;
  
  // matchup_resolved
  matchup_id?: string;
  winner_member_id?: string;
  loser_member_id?: string;
  decided_by?: string;
  result_type?: 'UPSET' | 'CAPTURED' | 'ADVANCES';
  home_score?: number;
  away_score?: number;
  winner_team?: string;
  loser_team?: string;
  spread?: { home_spread?: number; away_spread?: number };
  
  // capture-specific
  capturer_id?: string;
  captured_from_id?: string;
  underdog_team?: string;
  favorite_team?: string;
  underdog_spread?: number;
  
  [key: string]: unknown;
}

/**
 * Generate human-readable description from audit log payload
 */
export function generateAuditDescription(
  actionType: string,
  payload: AuditPayload | null,
  memberMap: Record<string, string>
): string {
  if (!payload) {
    return `Event: ${actionType}`;
  }

  switch (actionType) {
    case 'pool_started':
      return `Pool started with ${payload.teams_count || '?'} teams and ${payload.members_count || '?'} players`;

    case 'member_joined':
      return `${payload.display_name || 'Someone'} joined the pool`;

    case 'teams_assigned':
      return `Teams randomly assigned to ${payload.count || '?'} players`;

    case 'matchup_resolved': {
      const resultType = payload.result_type;
      
      // Favorite covers (wins by more than spread) - no capture
      if (resultType === 'ADVANCES') {
        // Fallback: use winner_member_id if no specific capturer_id
        const winnerName = payload.winner_member_id 
          ? memberMap[payload.winner_member_id] || 'Unknown'
          : 'No owner';
        const teamName = payload.winner_team || 'Team';
        const spread = formatSpread(payload.spread, payload.winner_team, payload);
        return `${teamName}${spread} covered and advances. ${winnerName} moves on.`;
      }
      
      // Underdog wins outright - no capture, just a straight-up win
      if (resultType === 'UPSET') {
        const winnerName = payload.winner_member_id 
          ? memberMap[payload.winner_member_id] || 'Unknown'
          : 'No owner';
        const teamName = payload.underdog_team || payload.winner_team || 'Team';
        const spread = payload.underdog_spread ? ` (+${Math.abs(payload.underdog_spread)})` : '';
        return `${teamName}${spread} wins outright and advances! ${winnerName} moves on.`;
      }
      
      // TRUE CAPTURE: Underdog loses but covers the spread
      // The favorite advances, but ownership transfers to underdog's owner
      if (resultType === 'CAPTURED') {
        // Fallback: use winner/loser_member_id if capturer/captured_from not present
        const capturerId = payload.capturer_id || payload.winner_member_id;
        const capturedFromId = payload.captured_from_id || payload.loser_member_id;
        const capturer = capturerId 
          ? memberMap[capturerId] || 'Unknown'
          : 'Unknown';
        const capturedFrom = capturedFromId 
          ? memberMap[capturedFromId] || 'Unknown'
          : 'Unknown';
        const underdogTeam = payload.underdog_team || 'Underdog';
        const favoriteTeam = payload.favorite_team || 'Favorite';
        const spread = payload.underdog_spread ? ` (+${Math.abs(payload.underdog_spread)})` : '';
        return `${underdogTeam}${spread} loses but covers. ${capturer} captures ${favoriteTeam} from ${capturedFrom}.`;
      }

      // Fallback for resolved matchups without specific result type
      const score = (payload.home_score !== undefined && payload.away_score !== undefined)
        ? ` (${payload.home_score}-${payload.away_score})`
        : '';
      return `Matchup resolved${score}`;
    }

    default:
      return `Event: ${actionType}`;
  }
}

function formatSpread(
  spread: { home_spread?: number; away_spread?: number } | undefined,
  winnerTeam: string | undefined,
  payload: AuditPayload
): string {
  if (!spread) return '';
  
  // Try to determine if winner was home or away based on payload
  // This is a simplified version - could be enhanced with more data
  const spreadValue = spread.home_spread ?? spread.away_spread;
  if (spreadValue === undefined) return '';
  
  const formatted = spreadValue > 0 ? `+${spreadValue}` : `${spreadValue}`;
  return ` (${formatted})`;
}

/**
 * Transform raw audit log data to AuditLogEntry array
 */
export function transformAuditLogs(
  rawLogs: Array<{
    id: string;
    action_type: string;
    payload: unknown;
    created_at: string;
    actor_user_id?: string | null;
  }>,
  memberMap: Record<string, string>
): AuditLogEntry[] {
  return rawLogs.map(log => ({
    id: log.id,
    poolId: '', // Will be the same for all in context
    actorName: log.actor_user_id ? memberMap[log.actor_user_id] || 'System' : 'System',
    actionType: log.action_type,
    description: generateAuditDescription(log.action_type, log.payload as AuditPayload, memberMap),
    createdAt: new Date(log.created_at),
  }));
}
