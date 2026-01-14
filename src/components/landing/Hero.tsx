import { Button } from '@/components/ui/button';
import { Trophy, Users, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import bracketBountyLogo from '@/assets/bracketbounty-logo.png';

export function Hero() {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Background gradient - navy to white */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
      
      {/* Decorative elements with brand colors */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-accent/15 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-brand-green/10 rounded-full blur-3xl" />
      <div className="absolute top-40 right-20 w-48 h-48 bg-primary/5 rounded-full blur-2xl" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
        {/* Logo - prominently displayed */}
        <div className="mb-8 animate-fade-in">
          <img 
            src={bracketBountyLogo} 
            alt="BracketBounty" 
            className="h-28 md:h-40 lg:h-48 w-auto mx-auto drop-shadow-lg"
          />
        </div>

        {/* Tagline */}
        <p className="text-xl md:text-2xl lg:text-3xl font-display text-primary tracking-wide mb-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
          PLAYOFF POOLS FOR FRIENDS
        </p>

        {/* Subheading */}
        <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: '200ms' }}>
          Create private playoff pools with friends. Track brackets, capture teams, and crown champions. 
          No gambling, just glory.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-fade-in" style={{ animationDelay: '300ms' }}>
          <Button size="lg" className="gap-2 px-8 h-14 text-lg bg-primary hover:bg-primary/90 shadow-lg">
            <Trophy className="w-5 h-5" />
            Create a Pool
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button size="lg" variant="outline" className="gap-2 px-8 h-14 text-lg border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
            <Users className="w-5 h-5" />
            Join with Code
          </Button>
        </div>

        {/* Demo link */}
        <Link 
          to="/demo" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors animate-fade-in"
          style={{ animationDelay: '400ms' }}
        >
          View demo bracket
          <ArrowRight className="w-4 h-4" />
        </Link>

        {/* Feature pills with brand colors */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-12 animate-fade-in" style={{ animationDelay: '500ms' }}>
          {[
            { icon: Trophy, label: 'NFL & NBA Playoffs', color: 'text-accent' },
            { icon: Sparkles, label: 'Capture Mode', color: 'text-brand-green' },
            { icon: Users, label: 'Private Pools', color: 'text-primary' },
          ].map((feature) => (
            <div 
              key={feature.label}
              className="flex items-center gap-2 px-4 py-2 bg-card rounded-full shadow-matchup border border-border"
            >
              <feature.icon className={`w-4 h-4 ${feature.color}`} />
              <span className="text-sm font-medium text-foreground">{feature.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
