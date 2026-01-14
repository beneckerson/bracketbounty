import { Trophy } from 'lucide-react';

export function Footer() {
  return (
    <footer className="py-8 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-accent" />
          <span className="font-display text-xl">BRACKETBOUNTY</span>
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Pool management for private groups. We don't handle money or process bets.
        </p>
        <p className="text-xs text-muted-foreground">
          © 2026 BracketBounty
        </p>
      </div>
    </footer>
  );
}
