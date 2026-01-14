import { cn } from '@/lib/utils';
import type { PoolMember } from '@/lib/types';
import { getTeamByCode } from '@/lib/demo-data';
import { OwnerAvatar } from '@/components/ui/owner-avatar';
import { Sparkles } from 'lucide-react';

interface OwnedTeamsListProps {
  members: PoolMember[];
  className?: string;
}

export function OwnedTeamsList({ members, className }: OwnedTeamsListProps) {
  // Only show members with owned teams
  const activeMembers = members.filter(m => m.ownedTeams.length > 0);

  return (
    <div className={cn('space-y-3', className)}>
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        Active Owners
      </h3>
      <div className="space-y-2">
        {activeMembers.map((member) => (
          <div 
            key={member.id} 
            className="bg-card rounded-xl p-3 shadow-matchup"
          >
            <div className="flex items-center gap-3 mb-2">
              <OwnerAvatar
                displayName={member.participant.displayName}
                initials={member.participant.initials}
                avatarUrl={member.participant.avatarUrl}
                size="md"
              />
              <div>
                <span className="font-medium text-sm">{member.participant.displayName}</span>
                {member.role === 'creator' && (
                  <span className="ml-2 text-xs text-accent font-medium">Commissioner</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {member.ownedTeams.map((ot) => {
                const team = getTeamByCode(ot.teamCode);
                if (!team) return null;
                return (
                  <span 
                    key={ot.teamCode}
                    className={cn(
                      'owned-team-pill',
                      ot.acquiredVia === 'capture' && 'ring-1 ring-capture/50'
                    )}
                  >
                    {team.abbreviation}
                    {ot.acquiredVia === 'capture' && (
                      <Sparkles className="w-3 h-3 text-capture" />
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Eliminated members */}
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mt-6">
        Eliminated
      </h3>
      <div className="flex flex-wrap gap-2">
        {members.filter(m => m.ownedTeams.length === 0).map((member) => (
          <div 
            key={member.id}
            className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full opacity-60"
          >
            <OwnerAvatar
              displayName={member.participant.displayName}
              initials={member.participant.initials}
              avatarUrl={member.participant.avatarUrl}
              size="sm"
            />
            <span className="text-sm text-muted-foreground line-through">
              {member.participant.displayName.split(' ')[0]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
