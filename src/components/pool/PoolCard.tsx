import { Link } from 'react-router-dom';
import { Users, DollarSign, Calendar, ArrowRight, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getCompetition } from '@/lib/competitions';

interface PoolCardProps {
  pool: {
    id: string;
    name: string;
    competition_key: string;
    season: string;
    status: 'draft' | 'lobby' | 'active' | 'completed';
    mode: 'capture' | 'standard';
    buyin_amount_cents: number | null;
    max_players: number | null;
    invite_code: string;
    created_at: string;
    memberCount?: number;
  };
  isCreator?: boolean;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  lobby: 'bg-yellow-500/10 text-yellow-600',
  lobby_full: 'bg-green-500/10 text-green-600',
  active: 'bg-green-500/10 text-green-600',
  completed: 'bg-blue-500/10 text-blue-600',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  lobby: 'Waiting for Players',
  lobby_full: 'Ready to Start',
  active: 'In Progress',
  completed: 'Completed',
};

export function PoolCard({ pool, isCreator }: PoolCardProps) {
  const [copied, setCopied] = useState(false);
  const competition = getCompetition(pool.competition_key);
  
  const buyinDisplay = pool.buyin_amount_cents && pool.buyin_amount_cents > 0
    ? `$${(pool.buyin_amount_cents / 100).toFixed(0)}`
    : 'Free';

  // Determine display status - show "Ready to Start" when pool is full
  const isFull = pool.max_players && (pool.memberCount || 0) >= pool.max_players;
  const displayStatus = pool.status === 'lobby' && isFull ? 'lobby_full' : pool.status;

  const copyCode = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(pool.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Link 
      to={`/pool/${pool.id}`}
      className="block bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-lg transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{competition?.icon || '🏆'}</span>
          <div>
            <h3 className="font-display text-lg text-foreground group-hover:text-primary transition-colors">
              {pool.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {competition?.shortName || pool.competition_key} • {pool.season}
            </p>
          </div>
        </div>
        <Badge className={statusColors[displayStatus]}>
          {statusLabels[displayStatus]}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          <span>{pool.memberCount || 1} / {pool.max_players || '—'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <DollarSign className="h-4 w-4" />
          <span>{buyinDisplay}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          <span>{new Date(pool.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border">
        {isCreator && pool.status === 'lobby' ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1.5 h-8"
            onClick={copyCode}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                {pool.invite_code}
              </>
            )}
          </Button>
        ) : (
          <Badge variant="outline" className="text-xs capitalize">
            {pool.mode} Mode
          </Badge>
        )}
        
        <span className="text-sm text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          View Pool
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
