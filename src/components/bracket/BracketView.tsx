import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { Pool, AuditLogEntry, Team } from '@/lib/types';
import { RoundTabs } from './RoundTabs';
import { MatchupCard } from './MatchupCard';
import { OwnedTeamsList } from './OwnedTeamsList';
import { AuditDrawer } from './AuditDrawer';
import { PushRuleInfo } from './PushRuleInfo';
import { CaptureRulesDrawer } from './CaptureRulesDrawer';
import { Trophy, Users, Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

interface BracketViewProps {
  pool: Pool;
  auditLogs: AuditLogEntry[];
}

export function BracketView({ pool, auditLogs }: BracketViewProps) {
  const { user } = useAuth();
  
  // Compute the most relevant round to show by default
  const defaultRoundId = useMemo(() => {
    const now = new Date();
    
    // 1. Find rounds with upcoming matchups (startTime in the future)
    const roundsWithUpcoming = pool.rounds.map(round => {
      const upcomingMatchups = round.matchups.filter(m => 
        m.startTime && new Date(m.startTime) > now && m.status === 'upcoming'
      );
      const soonestMatchup = upcomingMatchups.reduce((min, m) => {
        if (!m.startTime) return min;
        return !min || new Date(m.startTime) < new Date(min.startTime) ? m : min;
      }, null as typeof round.matchups[0] | null);
      
      return { round, soonestMatchup };
    }).filter(r => r.soonestMatchup !== null);
    
    // 2. If there are rounds with upcoming matchups, pick the one with the soonest game
    if (roundsWithUpcoming.length > 0) {
      roundsWithUpcoming.sort((a, b) => 
        new Date(a.soonestMatchup!.startTime!).getTime() - 
        new Date(b.soonestMatchup!.startTime!).getTime()
      );
      return roundsWithUpcoming[0].round.id;
    }
    
    // 3. If no upcoming matchups, find the latest round with matchups (most recent action)
    const roundsWithMatchups = pool.rounds.filter(r => r.matchups.length > 0);
    if (roundsWithMatchups.length > 0) {
      // Return the latest round (highest order) that has matchups
      return roundsWithMatchups[roundsWithMatchups.length - 1].id;
    }
    
    // 4. Fallback to first round
    return pool.rounds[0]?.id || '';
  }, [pool.rounds]);
  
  const [activeRoundId, setActiveRoundId] = useState(defaultRoundId);
  
  const activeRound = pool.rounds.find(r => r.id === activeRoundId);
  
  // Build teams map from all matchups for the OwnedTeamsList
  const teamsMap = useMemo(() => {
    const map: Record<string, Team> = {};
    pool.rounds?.forEach(round => {
      round.matchups.forEach(matchup => {
        map[matchup.teamA.team.code] = matchup.teamA.team;
        map[matchup.teamB.team.code] = matchup.teamB.team;
      });
    });
    return map;
  }, [pool.rounds]);
  
  // Check if there are any whole-point spreads (potential pushes)
  const hasWholePointSpreads = useMemo(() => {
    if (pool.mode !== 'capture' || pool.scoringRule !== 'ats') return false;
    
    return pool.rounds.some(round =>
      round.matchups.some(matchup => {
        const spreadA = matchup.teamA.spread;
        const spreadB = matchup.teamB.spread;
        // Check if spread is a whole number (no .5)
        return (spreadA !== undefined && spreadA % 1 === 0) || 
               (spreadB !== undefined && spreadB % 1 === 0);
      })
    );
  }, [pool.rounds, pool.mode, pool.scoringRule]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3">
        <div className="max-w-4xl mx-auto">
          {/* Top row: Back + History */}
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" size="sm" asChild className="gap-1 -ml-2 text-muted-foreground hover:text-foreground">
              <Link to={user ? "/my-pools" : "/"}>
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Link>
            </Button>
            <div className="flex items-center gap-1">
              {pool.mode === 'capture' && <CaptureRulesDrawer />}
              <AuditDrawer logs={auditLogs} />
            </div>
          </div>
          
          {/* Pool title - full width, no overlap */}
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl text-foreground tracking-wide leading-tight">
            {pool.name}
          </h1>
          
          {/* Meta info row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {pool.members.length} players
            </span>
            <span className="hidden sm:inline">•</span>
            <span>${(pool.buyinAmountCents / 100).toFixed(0)} buy-in</span>
            {pool.mode === 'capture' && (
              <>
                <span className="hidden sm:inline">•</span>
                <span className="flex items-center gap-1 text-capture font-medium">
                  <Sparkles className="w-4 h-4" />
                  <span className="hidden xs:inline">Capture</span> Mode
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Round Tabs */}
      <RoundTabs 
        rounds={pool.rounds}
        activeRoundId={activeRoundId}
        onSelectRound={setActiveRoundId}
      />

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Matchups Column */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-xl text-foreground">
                {activeRound?.name}
              </h2>
              <span className="text-sm text-muted-foreground">
                {activeRound?.matchups.length} matchups
              </span>
            </div>
            
            <div className="space-y-4">
              {activeRound?.matchups.map((matchup, index) => (
                <div 
                  key={matchup.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <MatchupCard 
                    matchup={matchup} 
                    pool={pool}
                    showCapture={pool.mode === 'capture'}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Push Rule Info - show for capture mode when whole-point spreads exist */}
            {hasWholePointSpreads && (
              <PushRuleInfo />
            )}
            
            {pool.mode === 'capture' && (
              <OwnedTeamsList members={pool.members} teamsMap={teamsMap} />
            )}
            
            {/* Pool Info Card */}
            <div className="bg-card rounded-xl p-4 shadow-matchup">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                Pool Info
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mode</span>
                  <span className="font-medium capitalize">{pool.mode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scoring</span>
                  <span className="font-medium uppercase">{pool.scoringRule}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Teams/Player</span>
                  <span className="font-medium">{pool.teamsPerPlayer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invite Code</span>
                  <span className="font-mono font-medium text-primary">{pool.inviteCode}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
