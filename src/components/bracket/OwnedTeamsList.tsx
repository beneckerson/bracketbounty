import { cn } from '@/lib/utils';
import type { PoolMember, Team } from '@/lib/types';
import { OwnerAvatar } from '@/components/ui/owner-avatar';
import { Sparkles } from 'lucide-react';

interface OwnedTeamsListProps {
  members: PoolMember[];
  teamsMap: Record<string, Team>;
  className?: string;
}

export function OwnedTeamsList({ members, teamsMap, className }: OwnedTeamsListProps) {
  // Active = has owned teams; Eliminated = no owned teams but has lost teams
  const activeMembers = members.filter(m => m.ownedTeams.length > 0);
  const eliminatedMembers = members.filter(m => m.ownedTeams.length === 0 && (m.lostTeams?.length ?? 0) > 0);

  return (
    <div className={cn('space-y-3', className)}>
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        Active Owners
      </h3>
      <div className="space-y-2">
        {activeMembers.map((member) => (
          <MemberCard key={member.id} member={member} teamsMap={teamsMap} />
        ))}
      </div>

      {/* Eliminated members */}
      {eliminatedMembers.length > 0 && (
        <>
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mt-6">
            Eliminated
          </h3>
          <div className="space-y-2">
            {eliminatedMembers.map((member) => (
              <div 
                key={member.id}
                className="bg-card rounded-xl p-3 shadow-matchup opacity-60"
              >
                <div className="flex items-center gap-3 mb-2">
                  <OwnerAvatar
                    participantId={member.participant.id}
                    displayName={member.participant.displayName}
                    initials={member.participant.initials}
                    avatarUrl={member.participant.avatarUrl}
                    size="md"
                  />
                  <div>
                    <span className="font-medium text-sm line-through text-muted-foreground">
                      {member.participant.displayName}
                    </span>
                    {member.role === 'creator' && (
                      <span className="ml-2 text-xs text-accent font-medium">Commissioner</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {member.lostTeams?.map((lt) => (
                    <LostTeamPill key={lt.teamCode} teamCode={lt.teamCode} lostVia={lt.lostVia} teamsMap={teamsMap} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MemberCard({ member, teamsMap }: { member: PoolMember; teamsMap: Record<string, Team> }) {
  return (
    <div className="bg-card rounded-xl p-3 shadow-matchup">
      <div className="flex items-center gap-3 mb-2">
        <OwnerAvatar
          participantId={member.participant.id}
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
          const team = teamsMap[ot.teamCode];
          return (
            <span 
              key={ot.teamCode}
              className={cn(
                'owned-team-pill',
                ot.acquiredVia === 'capture' && 'ring-1 ring-capture/50'
              )}
            >
              {team?.abbreviation || ot.teamCode}
              {ot.acquiredVia === 'capture' && (
                <Sparkles className="w-3 h-3 text-capture" />
              )}
            </span>
          );
        })}
        {member.lostTeams?.map((lt) => (
          <LostTeamPill key={lt.teamCode} teamCode={lt.teamCode} lostVia={lt.lostVia} teamsMap={teamsMap} />
        ))}
      </div>
    </div>
  );
}

function LostTeamPill({ teamCode, lostVia, teamsMap }: { teamCode: string; lostVia: 'eliminated' | 'captured'; teamsMap: Record<string, Team> }) {
  const team = teamsMap[teamCode];
  return (
    <span className="owned-team-pill opacity-40 line-through">
      {team?.abbreviation || teamCode}
      <span className="text-[10px] no-underline ml-0.5 font-normal">
        {lostVia === 'captured' ? "Cap'd" : 'Elim'}
      </span>
    </span>
  );
}
