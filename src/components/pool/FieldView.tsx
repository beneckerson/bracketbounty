import { useEffect, useMemo, useState } from 'react';
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
  selectedTeams: string[];
  onWinnerDeclared: () => void;
}

interface HorseRow {
  teamCode: string;
  seed: number | null;
  ownerMemberId: string | null;
  ownerName: string | null;
  ownerInitials: string | null;
}

const formatHorseName = (code: string) =>
  code
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

export function FieldView({
  pool,
  poolStatus,
  poolDbId,
  isCreator,
  winnerMemberId,
  selectedTeams,
  onWinnerDeclared,
}: FieldViewProps) {
  const { user } = useAuth();
  const [submittingWinner, setSubmittingWinner] = useState<string | null>(null);
  const [seedMap, setSeedMap] = useState<Record<string, number | null>>({});

  // Fetch seeds from competition_rosters so we can sort the field like a program
  useEffect(() => {
    let cancelled = false;
    if (!selectedTeams.length) return;
    (async () => {
      const { data } = await supabase
        .from('competition_rosters')
        .select('team_code, seed')
        .eq('competition_key', 'kentucky_derby')
        .eq('season', pool.season)
        .in('team_code', selectedTeams);
      if (cancelled) return;
      const map: Record<string, number | null> = {};
      (data || []).forEach((r: { team_code: string; seed: number | null }) => {
        map[r.team_code] = r.seed;
      });
      setSeedMap(map);
    })();
    return () => { cancelled = true; };
  }, [selectedTeams, pool.season]);

  // Build owner map: team_code -> member
  const ownerByTeam = useMemo(() => {
    const map: Record<string, { memberId: string; name: string; initials: string }> = {};
    pool.members.forEach((m) => {
      m.ownedTeams.forEach((ot) => {
        map[ot.teamCode] = {
          memberId: m.id,
          name: m.participant.displayName,
          initials: m.participant.initials,
        };
      });
    });
    return map;
  }, [pool.members]);

  const horses: HorseRow[] = useMemo(() => {
    return selectedTeams.map((code) => {
      const owner = ownerByTeam[code];
      return {
        teamCode: code,
        seed: seedMap[code] ?? null,
        ownerMemberId: owner?.memberId ?? null,
        ownerName: owner?.name ?? null,
        ownerInitials: owner?.initials ?? null,
      };
    });
  }, [selectedTeams, ownerByTeam, seedMap]);

  const sortedHorses = useMemo(() => {
    return [...horses].sort((a, b) => {
      const sa = a.seed ?? Number.MAX_SAFE_INTEGER;
      const sb = b.seed ?? Number.MAX_SAFE_INTEGER;
      if (sa !== sb) return sa - sb;
      return a.teamCode.localeCompare(b.teamCode);
    });
  }, [horses]);

  const ownedCount = horses.filter((h) => h.ownerMemberId).length;
  const fieldCount = horses.length - ownedCount;

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
            <p className="text-muted-foreground">
              Kentucky Derby • {pool.season} • {ownedCount} drawn • {fieldCount} in the field
            </p>
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
        {sortedHorses.map((horse) => {
          const isWinner = horse.ownerMemberId === winnerMemberId && poolStatus === 'completed';
          const isOwned = !!horse.ownerMemberId;
          return (
            <Card
              key={horse.teamCode}
              className={cn(
                'transition-colors',
                isWinner && 'border-primary ring-2 ring-primary/30 bg-primary/5',
                !isOwned && 'opacity-70 border-dashed'
              )}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-base text-foreground truncate">
                      {formatHorseName(horse.teamCode)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {horse.seed != null ? `Post ${horse.seed}` : 'Horse'}
                    </p>
                  </div>
                  {isWinner && <Trophy className="h-5 w-5 text-primary flex-shrink-0" />}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  {isOwned ? (
                    <>
                      <OwnerAvatar
                        participantId={horse.ownerMemberId!}
                        displayName={horse.ownerName ?? '?'}
                        initials={horse.ownerInitials ?? '?'}
                        size="sm"
                      />
                      <span className="text-sm font-medium truncate">{horse.ownerName}</span>
                    </>
                  ) : (
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      In the field
                    </span>
                  )}
                </div>

                {isCreator && poolStatus === 'active' && isOwned && (
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

      {sortedHorses.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No horses have been added yet.
        </div>
      )}
    </div>
  );
}
