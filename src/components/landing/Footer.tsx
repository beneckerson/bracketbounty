import bracketBountyLogo from '@/assets/bracketbounty-logo.png';

export function Footer() {
  return (
    <footer className="py-8 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <img 
          src={bracketBountyLogo} 
          alt="BracketBounty" 
          className="h-10 md:h-12 w-auto opacity-90 hover:opacity-100 transition-opacity"
        />
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
