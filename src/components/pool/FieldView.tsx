import { useMemo, useState } from 'react';
import { Trophy, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { OwnerAvatar } from '@/components/ui/owner-avatar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { Pool as PoolType } from '@/lib/types';

interface FieldViewProps {
  pool: PoolType;
  poolStatus: 'active' | 'completed';
  poolDbId: string;
  isCreator: boolean;
  winnerMemberId?: string | null;
  onWinnerDeclared: () => void;
}

interface HorseRow {
  teamCode: string;
  name: string;
  abbreviation: string;
  color: string;
  seed: number | null;
  ownerMemberId: string | null;
  ownerName: string | null;
  ownerInitials: string | null;
}

export function FieldView({
  pool,
  poolStatus,
  poolDbId,
  isCreator,
  winnerMemberId,
  onWinnerDeclared,
}: FieldViewProps) {
  const { user } = useAuth();
  const [submittingWinner, setSubmittingWinner] = useState<string | null>(null);

  // Build a row per horse using ownership info on members
  const horses: HorseRow[] = useMemo(() => {
    const rows: HorseRow[] = [];
    pool.members.forEach((m) => {
      m.ownedTeams.forEach((ot) => {
        rows.push({
          teamCode: ot.teamCode,
          name: ot.teamCode, // populated from team lookup below if needed
          abbreviation: ot.teamCode,
          color: 'team-gray',
          seed: null,
          ownerMemberId: m.id,
          ownerName: m.participant.displayName,
          ownerInitials: m.participant.initials,
        });
      });
    });

    // Enrich with team metadata from rounds[0].matchups isn't useful here;
    // pool.members already include team info via matchups in BracketView.
    // We rely on the pool object's own roster data set by transform.
    return rows;
  }, [pool.members]);

  // Try to also enrich names/seed from any teams found on the pool (fallback to code)
  // The Pool transform stores team display info in members' ownedTeams only as codes,
  // so we display the code with a friendlier formatter.
  const formatHorseName = (code: string) =>
    code
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const winningHorse = horses.find((h) => h.ownerMemberId === winnerMemberId);
  const winnerName = winningHorse?.ownerName;

  const handleDeclareWinner = async (horse: HorseRow) => {
    if (!horse.ownerMemberId) return;
    if (!confirm(`Declare ${formatHorseName(horse.teamCode)} as the winner? This will end the pool.`)) {
      return;
    }
    setSubmittingWinner(horse.teamCode);
    try {
      const { error: poolErr } = await supabase
        .from('pools')
        .update({ status: 'completed', winner_member_id: horse.ownerMemberId })
        .eq('id', poolDbId);
      if (poolErr) throw poolErr;

      await supabase.from('audit_log').insert({
        pool_id: poolDbId,
        actor_user_id: user?.id ?? null,
        action_type: 'derby_winner_declared',
        payload: {
          team_code: horse.teamCode,
          horse_name: formatHorseName(horse.teamCode),
          winner_member_id: horse.ownerMemberId,
          winner_name: horse.ownerName,
        },
      });

      toast.success(`${formatHorseName(horse.teamCode)} wins! Pool completed.`);
      onWinnerDeclared();
    } catch (err) {
      console.error('Failed to declare winner', err);
      toast.error('Failed to declare winner');
    } finally {
      setSubmittingWinner(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <span className="text-5xl">🐎</span>
          <div className="flex-1">
            <h1 className="text-2xl font-bebas tracking-wide text-foreground">{pool.name}</h1>
            <p className="text-muted-foreground">Kentucky Derby • {pool.season}</p>
          </div>
          <Badge variant={poolStatus === 'completed' ? 'default' : 'secondary'}>
            {poolStatus === 'completed' ? 'Final' : 'The Field'}
          </Badge>
        </div>

        {poolStatus === 'completed' && winnerName && (
          <div className="mt-4 flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/30">
            <Trophy className="h-6 w-6 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Winner</p>
              <p className="font-display text-lg text-foreground">
                {winnerName} — {winningHorse ? formatHorseName(winningHorse.teamCode) : ''}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* The field */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {horses
          .slice()
          .sort((a, b) => a.teamCode.localeCompare(b.teamCode))
          .map((horse) => {
            const isWinner = horse.ownerMemberId === winnerMemberId && poolStatus === 'completed';
            return (
              <Card
                key={horse.teamCode}
                className={cn(
                  'transition-colors',
                  isWinner && 'border-primary ring-2 ring-primary/30 bg-primary/5'
                )}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-base text-foreground truncate">
                        {formatHorseName(horse.teamCode)}
                      </p>
                      <p className="text-xs text-muted-foreground">Horse</p>
                    </div>
                    {isWinner && <Trophy className="h-5 w-5 text-primary flex-shrink-0" />}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <OwnerAvatar
                      name={horse.ownerName ?? '?'}
                      initials={horse.ownerInitials ?? '?'}
                      size="sm"
                    />
                    <span className="text-sm font-medium truncate">{horse.ownerName}</span>
                  </div>

                  {isCreator && poolStatus === 'active' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={submittingWinner !== null}
                      onClick={() => handleDeclareWinner(horse)}
                    >
                      {submittingWinner === horse.teamCode ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-2" />
                      ) : (
                        <Trophy className="h-3 w-3 mr-2" />
                      )}
                      Declare winner
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
      </div>

      {horses.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No horses have been assigned yet.
        </div>
      )}
    </div>
  );
}
