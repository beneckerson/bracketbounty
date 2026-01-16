import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OwnerAvatar } from '@/components/ui/owner-avatar';
import { Sparkles, Trophy, Users } from 'lucide-react';

interface TeamAssignment {
  member_id: string;
  member_name: string;
  team_code: string;
  team_name: string;
  team_abbreviation: string;
}

interface TeamAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignments: TeamAssignment[];
  onViewBracket: () => void;
}

export function TeamAssignmentDialog({
  open,
  onOpenChange,
  assignments,
  onViewBracket,
}: TeamAssignmentDialogProps) {
  // Group assignments by member
  const assignmentsByMember: Record<string, { name: string; teams: TeamAssignment[] }> = {};
  
  assignments.forEach(assignment => {
    if (!assignmentsByMember[assignment.member_id]) {
      assignmentsByMember[assignment.member_id] = {
        name: assignment.member_name,
        teams: [],
      };
    }
    assignmentsByMember[assignment.member_id].teams.push(assignment);
  });

  const memberEntries = Object.entries(assignmentsByMember);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <DialogTitle className="font-bebas tracking-wide text-xl">
              Teams Assigned!
            </DialogTitle>
          </div>
          <DialogDescription>
            Teams have been randomly distributed among all players. Good luck!
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            {memberEntries.map(([memberId, { name, teams }], index) => (
              <div
                key={memberId}
                className="bg-muted/50 rounded-lg p-4 animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <OwnerAvatar
                    participantId={memberId}
                    displayName={name}
                    initials={name.charAt(0).toUpperCase()}
                    size="md"
                  />
                  <h3 className="font-medium text-foreground">{name}</h3>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {teams.length} team{teams.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {teams.map((team, teamIndex) => (
                    <div
                      key={team.team_code}
                      className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 text-sm animate-scale-in"
                      style={{ animationDelay: `${(index * 100) + (teamIndex * 50)}ms` }}
                    >
                      <Trophy className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium">{team.team_abbreviation}</span>
                      <span className="text-muted-foreground text-xs hidden sm:inline">
                        {team.team_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{memberEntries.length} players • {assignments.length} teams</span>
          </div>
          <Button onClick={onViewBracket}>
            View Bracket
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
