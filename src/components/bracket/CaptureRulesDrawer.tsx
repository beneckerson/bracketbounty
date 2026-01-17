import { useState } from 'react';
import { HelpCircle, Trophy, Sparkles, ArrowRight, Target, Scale, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

interface RuleCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  example?: string;
  colorClass: string;
  iconBgClass: string;
}

function RuleCard({ icon, title, subtitle, description, example, colorClass, iconBgClass }: RuleCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="bg-card rounded-xl p-4 border border-border">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg shrink-0", iconBgClass)}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={cn("text-xs font-semibold uppercase tracking-wider", colorClass)}>
                {subtitle}
              </span>
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </div>
            <h4 className="font-semibold text-foreground mt-0.5">{title}</h4>
          </div>
        </div>
      </button>
      
      {expanded && (
        <div className="mt-3 pl-11 space-y-2 animate-fade-in">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
          {example && (
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Example: </span>
              {example}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CaptureRulesDrawer() {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
          <HelpCircle className="w-4 h-4" />
          <span className="hidden xs:inline">How It Works</span>
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle className="flex items-center gap-2 font-display text-xl">
            <Sparkles className="w-5 h-5 text-capture" />
            How Capture Mode Works
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="px-4 pb-6 overflow-y-auto space-y-4">
          {/* Overview */}
          <div className="bg-gradient-to-br from-capture/10 to-capture/5 rounded-xl p-4 border border-capture/20">
            <p className="text-sm text-foreground leading-relaxed">
              In Capture Mode, matchups are decided by the <strong>point spread (ATS)</strong>. 
              When an underdog covers the spread, they can <em>capture</em> the opponent's team—even 
              if they lose the game outright.
            </p>
          </div>
          
          {/* Outcome Types */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Possible Outcomes
            </h3>
            
            <RuleCard
              icon={<Trophy className="w-4 h-4 text-winner" />}
              iconBgClass="bg-winner/20"
              colorClass="text-winner"
              subtitle="Favorite Covers"
              title="Advances"
              description="The favorite wins and covers the spread. They advance to the next round with no ownership change. The favorite's owner keeps their team."
              example="Chiefs (-7) beat Bills 31-21. Chiefs cover (10-point margin > 7). Chiefs owner advances."
            />
            
            <RuleCard
              icon={<Target className="w-4 h-4 text-upset" />}
              iconBgClass="bg-upset/20"
              colorClass="text-upset"
              subtitle="Underdog Wins"
              title="Upset"
              description="The underdog wins the game outright. They advance and no capture occurs—the underdog's owner keeps their team and moves forward."
              example="Bills (+7) beat Chiefs 24-21. Bills win outright, so it's an upset. Bills owner advances."
            />
            
            <RuleCard
              icon={<Sparkles className="w-4 h-4 text-capture" />}
              iconBgClass="bg-capture/20"
              colorClass="text-capture"
              subtitle="Underdog Covers"
              title="Captured"
              description="The underdog loses the game BUT covers the spread. The favorite advances, but their team is captured by the underdog's owner. This is the signature Capture Mode mechanic!"
              example="Bills (+7) lose 24-28. They covered (lost by 4 < 7). Chiefs advance, but Chiefs are now owned by the Bills owner."
            />
          </div>
          
          {/* Push Rule */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Special Case
            </h3>
            
            <RuleCard
              icon={<Scale className="w-4 h-4 text-foreground" />}
              iconBgClass="bg-muted/50"
              colorClass="text-foreground/70"
              subtitle="Exact Spread"
              title="Push Rule"
              description="If the final margin exactly matches a whole-number spread (e.g., 7-point spread with 7-point margin), it's a push. The game winner advances with no capture. Spreads with .5 cannot push."
              example="Spread is -7, final score is 28-21 (exactly 7). Push—game winner advances, no capture."
            />
          </div>
          
          {/* Quick Reference */}
          <div className="bg-muted/30 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm text-foreground">Quick Reference</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-winner" />
                <span className="text-muted-foreground">Favorite covers → Favorite advances (no capture)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-upset" />
                <span className="text-muted-foreground">Underdog wins → Underdog advances (no capture)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-capture" />
                <span className="text-muted-foreground">Underdog covers (but loses) → Favorite advances, team captured!</span>
              </div>
            </div>
          </div>
          
          {/* Goal */}
          <div className="text-center pt-2">
            <p className="text-xs text-muted-foreground">
              <Trophy className="w-3 h-3 inline mr-1" />
              Goal: Own the team that wins the championship!
            </p>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
