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
  spread?: { 
    home_spread?: number; 
    away_spread?: number;
    home_team?: string;
    away_team?: string;
  };
  
  // capture-specific
  capturer_id?: string;
  captured_from_id?: string;
  underdog_team?: string;
  favorite_team?: string;
  underdog_spread?: number;
  
  // ownership_assigned
  team_code?: string;
  member_display_name?: string;
  reason?: string;
  
  [key: string]: unknown;
}

/**
 * Determine teams from spread data when explicit fields are missing
 */
function determineTeamsFromSpread(payload: AuditPayload): { 
  winner: string; 
  loser: string; 
  favorite: string; 
  underdog: string 
} {
  const spread = payload.spread;
  if (!spread) return { winner: 'Team', loser: 'Team', favorite: 'Favorite', underdog: 'Underdog' };
  
  const homeSpread = spread.home_spread ?? 0;
  const homeTeam = spread.home_team || 'Home';
  const awayTeam = spread.away_team || 'Away';
  
  // Positive spread = underdog, Negative spread = favorite
  const isHomeFavorite = homeSpread < 0;
  const favorite = isHomeFavorite ? homeTeam : awayTeam;
  const underdog = isHomeFavorite ? awayTeam : homeTeam;
  
  // For ADVANCES, the favorite won and covered
  // For CAPTURED, the favorite won but underdog covered
  // For UPSET, the underdog won outright
  return {
    winner: payload.result_type === 'UPSET' ? underdog : favorite,
    loser: payload.result_type === 'UPSET' ? favorite : underdog,
    favorite,
    underdog
  };
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
        const winnerName = payload.winner_member_id 
          ? memberMap[payload.winner_member_id] || 'Unknown'
          : 'No owner';
        
        // Try multiple fallback sources for team name
        const teams = determineTeamsFromSpread(payload);
        const teamName = payload.winner_team 
          || payload.favorite_team 
          || teams.favorite;
        
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
        const capturerId = payload.capturer_id || payload.winner_member_id;
        const capturedFromId = payload.captured_from_id || payload.loser_member_id;
        
        const capturer = capturerId 
          ? memberMap[capturerId] || 'Unknown'
          : 'Unknown';
        
        // For old entries without captured_from_id, use "their opponent" as fallback
        const capturedFrom = capturedFromId 
          ? memberMap[capturedFromId] || 'their opponent'
          : 'their opponent';
        
        // Try multiple fallback sources for team names
        const teams = determineTeamsFromSpread(payload);
        const underdogTeam = payload.underdog_team || teams.underdog;
        const favoriteTeam = payload.favorite_team || teams.favorite;
        
        const spread = payload.underdog_spread 
          ? ` (+${Math.abs(payload.underdog_spread)})` 
          : '';
        return `${underdogTeam}${spread} loses but covers. ${capturer} captures ${favoriteTeam} from ${capturedFrom}.`;
      }

      // Fallback for resolved matchups without specific result type
      const score = (payload.home_score !== undefined && payload.away_score !== undefined)
        ? ` (${payload.home_score}-${payload.away_score})`
        : '';
      return `Matchup resolved${score}`;
    }

    case 'ownership_assigned': {
      const teamName = payload.team_name as string | undefined;
      const teamCode = payload.team_code || 'Team';
      const memberName = payload.member_display_name || 'member';
      
      // Use full name if available, otherwise format the code (remove _NFL suffix)
      const displayTeam = teamName || teamCode.replace(/_NFL$|_NBA$|_MLB$|_NHL$/, '');
      
      // Don't show admin reasons - they're internal notes
      return `${displayTeam} was assigned to ${memberName}`;
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
