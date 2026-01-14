import { Button } from '@/components/ui/button';
import { Trophy, Users, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Hero() {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10" />
      
      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-accent/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card shadow-card mb-6 animate-fade-in">
          <Sparkles className="w-4 h-4 text-capture" />
          <span className="text-sm font-medium">Private pools for friends</span>
        </div>

        {/* Main heading */}
        <h1 className="font-display text-5xl md:text-7xl lg:text-8xl text-foreground tracking-wide mb-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
          BRACKET<span className="text-accent">BOUNTY</span>
        </h1>

        {/* Subheading */}
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-fade-in" style={{ animationDelay: '200ms' }}>
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
          <Button size="lg" variant="outline" className="gap-2 px-8 h-14 text-lg border-2">
            <Users className="w-5 h-5" />
            Join with Code
          </Button>
        </div>

        {/* Demo link */}
        <Link 
          to="/demo" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors animate-fade-in"
          style={{ animationDelay: '400ms' }}
        >
          View demo bracket
          <ArrowRight className="w-4 h-4" />
        </Link>

        {/* Feature pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-12 animate-fade-in" style={{ animationDelay: '500ms' }}>
          {[
            { icon: Trophy, label: 'NFL & NBA Playoffs' },
            { icon: Sparkles, label: 'Capture Mode' },
            { icon: Users, label: 'Private Pools' },
          ].map((feature) => (
            <div 
              key={feature.label}
              className="flex items-center gap-2 px-4 py-2 bg-card rounded-full shadow-matchup"
            >
              <feature.icon className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{feature.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
