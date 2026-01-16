import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Pool, AuditLogEntry } from '@/lib/types';
import { RoundTabs } from './RoundTabs';
import { MatchupCard } from './MatchupCard';
import { OwnedTeamsList } from './OwnedTeamsList';
import { AuditDrawer } from './AuditDrawer';
import { Trophy, Users, Sparkles } from 'lucide-react';

interface BracketViewProps {
  pool: Pool;
  auditLogs: AuditLogEntry[];
}

export function BracketView({ pool, auditLogs }: BracketViewProps) {
  const [activeRoundId, setActiveRoundId] = useState(pool.rounds[0]?.id || '');
  
  const activeRound = pool.rounds.find(r => r.id === activeRoundId);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display text-3xl md:text-4xl text-foreground tracking-wide">
                {pool.name}
              </h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {pool.members.length} players
                </span>
                <span>•</span>
                <span>${(pool.buyinAmountCents / 100).toFixed(0)} buy-in</span>
                {pool.mode === 'capture' && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-capture font-medium">
                      <Sparkles className="w-4 h-4" />
                      Capture Mode
                    </span>
                  </>
                )}
              </div>
            </div>
            <AuditDrawer logs={auditLogs} />
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
            {pool.mode === 'capture' && (
              <OwnedTeamsList members={pool.members} />
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
