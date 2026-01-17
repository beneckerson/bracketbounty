import { useEffect, useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OwnerAvatar } from '@/components/ui/owner-avatar';
import { Sparkles, Trophy, Users, Shuffle } from 'lucide-react';
import confetti from 'canvas-confetti';

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
  showShuffleAnimation?: boolean;
}

// Shuffle animation phases
type AnimationPhase = 'shuffling' | 'revealing' | 'complete';

export function TeamAssignmentDialog({
  open,
  onOpenChange,
  assignments,
  onViewBracket,
  showShuffleAnimation = false,
}: TeamAssignmentDialogProps) {
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>(
    showShuffleAnimation ? 'shuffling' : 'complete'
  );
  const [revealedCount, setRevealedCount] = useState(0);
  const [shuffleDisplay, setShuffleDisplay] = useState<TeamAssignment[]>([]);

  // Group assignments by member
  const assignmentsByMember = useMemo(() => {
    const grouped: Record<string, { name: string; teams: TeamAssignment[] }> = {};
    
    assignments.forEach(assignment => {
      if (!grouped[assignment.member_id]) {
        grouped[assignment.member_id] = {
          name: assignment.member_name,
          teams: [],
        };
      }
      grouped[assignment.member_id].teams.push(assignment);
    });
    
    return grouped;
  }, [assignments]);

  const memberEntries = Object.entries(assignmentsByMember);
  const totalTeams = assignments.length;

  // Fire confetti celebration
  const fireConfetti = useCallback(() => {
    const duration = 3000;
    const end = Date.now() + duration;

    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }, []);

  // Create a shuffled display for the animation
  useEffect(() => {
    if (!showShuffleAnimation || !open) return;
    
    setAnimationPhase('shuffling');
    setRevealedCount(0);

    // Create rapid shuffle effect
    let shuffleInterval: NodeJS.Timeout;
    let shuffleCount = 0;
    const maxShuffles = 15;

    shuffleInterval = setInterval(() => {
      // Create a random shuffle of assignments
      const shuffled = [...assignments]
        .map(a => ({
          ...a,
          member_id: assignments[Math.floor(Math.random() * assignments.length)].member_id,
          member_name: assignments[Math.floor(Math.random() * assignments.length)].member_name,
        }))
        .sort(() => Math.random() - 0.5);
      
      setShuffleDisplay(shuffled);
      shuffleCount++;

      if (shuffleCount >= maxShuffles) {
        clearInterval(shuffleInterval);
        setAnimationPhase('revealing');
        
        // Start revealing teams one by one
        let revealIndex = 0;
        const revealInterval = setInterval(() => {
          revealIndex++;
          setRevealedCount(revealIndex);
          
          if (revealIndex >= totalTeams) {
            clearInterval(revealInterval);
            setTimeout(() => {
              setAnimationPhase('complete');
              fireConfetti();
            }, 300);
          }
        }, 150);
      }
    }, 100);

    return () => {
      clearInterval(shuffleInterval);
    };
  }, [open, showShuffleAnimation, assignments, totalTeams, fireConfetti]);

  // Reset animation state when dialog closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setAnimationPhase(showShuffleAnimation ? 'shuffling' : 'complete');
        setRevealedCount(0);
        setShuffleDisplay([]);
      }, 300);
    }
  }, [open, showShuffleAnimation]);

  const isShuffling = animationPhase === 'shuffling';
  const isRevealing = animationPhase === 'revealing';
  const isComplete = animationPhase === 'complete';

  // Calculate which teams are revealed (in order of the original assignments)
  const getIsTeamRevealed = (assignmentIndex: number) => {
    if (isComplete) return true;
    if (isShuffling) return false;
    return assignmentIndex < revealedCount;
  };

  // Get flat list with indices for reveal calculation
  const flatAssignments = assignments.map((a, i) => ({ ...a, globalIndex: i }));
  
  // Group with indices
  const assignmentsByMemberWithIndices = useMemo(() => {
    const grouped: Record<string, { name: string; teams: (TeamAssignment & { globalIndex: number })[] }> = {};
    
    flatAssignments.forEach(assignment => {
      if (!grouped[assignment.member_id]) {
        grouped[assignment.member_id] = {
          name: assignment.member_name,
          teams: [],
        };
      }
      grouped[assignment.member_id].teams.push(assignment);
    });
    
    return grouped;
  }, [flatAssignments]);

  const memberEntriesWithIndices = Object.entries(assignmentsByMemberWithIndices);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            {isShuffling ? (
              <Shuffle className="h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
            <DialogTitle className="font-bebas tracking-wide text-xl">
              {isShuffling ? 'Shuffling Teams...' : isRevealing ? 'Revealing Assignments...' : 'Teams Assigned!'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isShuffling 
              ? 'Randomly distributing teams among all players...'
              : isRevealing
              ? 'Locking in final assignments...'
              : 'Teams have been randomly distributed among all players. Good luck!'
            }
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            {isShuffling ? (
              // Shuffling display - rapid random assignments
              <div className="space-y-4">
                {memberEntries.map(([memberId, { name }], index) => (
                  <div
                    key={memberId}
                    className="bg-muted/50 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <OwnerAvatar
                        participantId={memberId}
                        displayName={name}
                        initials={name.charAt(0).toUpperCase()}
                        size="md"
                      />
                      <h3 className="font-medium text-foreground">{name}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {shuffleDisplay
                        .filter(s => s.member_id === memberId)
                        .slice(0, assignmentsByMember[memberId]?.teams.length || 1)
                        .map((team, teamIndex) => (
                          <div
                            key={`shuffle-${teamIndex}`}
                            className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 text-sm animate-pulse"
                          >
                            <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium text-muted-foreground">???</span>
                          </div>
                        ))
                      }
                      {(!shuffleDisplay.filter(s => s.member_id === memberId).length) && (
                        <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 text-sm animate-pulse">
                          <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium text-muted-foreground">???</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Revealing/Complete display
              memberEntriesWithIndices.map(([memberId, { name, teams }], index) => (
                <div
                  key={memberId}
                  className="bg-muted/50 rounded-lg p-4 animate-fade-in"
                  style={{ animationDelay: isComplete ? `${index * 100}ms` : '0ms' }}
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
                      {teams.filter(t => getIsTeamRevealed(t.globalIndex)).length} / {teams.length} team{teams.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {teams.map((team, teamIndex) => {
                      const isRevealed = getIsTeamRevealed(team.globalIndex);
                      return (
                        <div
                          key={team.team_code}
                          className={`flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 text-sm transition-all duration-300 ${
                            isRevealed 
                              ? 'opacity-100 scale-100' 
                              : 'opacity-40 scale-95'
                          }`}
                          style={{ 
                            animationDelay: isComplete ? `${(index * 100) + (teamIndex * 50)}ms` : '0ms',
                          }}
                        >
                          <Trophy className={`h-3.5 w-3.5 ${isRevealed ? 'text-primary' : 'text-muted-foreground'}`} />
                          <span className={`font-medium ${isRevealed ? '' : 'text-muted-foreground'}`}>
                            {isRevealed ? team.team_abbreviation : '???'}
                          </span>
                          {isRevealed && (
                            <span className="text-muted-foreground text-xs hidden sm:inline">
                              {team.team_name}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{memberEntries.length} players • {totalTeams} teams</span>
          </div>
          <Button 
            onClick={onViewBracket} 
            disabled={!isComplete}
          >
            {isComplete ? 'View Bracket' : 'Please wait...'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
