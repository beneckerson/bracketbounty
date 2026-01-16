import { Trophy, Sparkles, Shield, Users, Smartphone, Zap } from 'lucide-react';

const features = [
  {
    icon: Sparkles,
    title: 'Capture Mode',
    description: 'When a team covers the spread, you capture your opponent\'s teams. Underdogs can capture even when they lose. Watch empires build.',
    color: 'text-capture',
  },
  {
    icon: Trophy,
    title: 'Multi-Sport Support',
    description: 'NFL Playoffs, NBA Playoffs, College Football, March Madness, and more. One app, all brackets.',
    color: 'text-accent',
  },
  {
    icon: Users,
    title: 'Private Pools',
    description: 'Invite-only pools for your group. Share a link, teams are randomly assigned, then compete.',
    color: 'text-primary',
  },
  {
    icon: Shield,
    title: 'No Money Handling',
    description: 'We don\'t touch money. Track buy-ins, show Venmo handles at the end. You handle payouts.',
    color: 'text-winner',
  },
  {
    icon: Smartphone,
    title: 'Mobile First',
    description: 'Designed for phones. Check matchups, see who owns what, track captures on the go.',
    color: 'text-primary',
  },
  {
    icon: Zap,
    title: 'Real-time Updates',
    description: 'Scores are updated and team ownership transfers instantly. Everyone sees results together.',
    color: 'text-accent',
  },
];

export function Features() {
  return (
    <section className="py-20 px-4 bg-card">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-fugaz text-5xl md:text-6xl text-foreground tracking-wide mb-4">
            HOW IT WORKS
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Create a pool, invite friends, get assigned teams, and compete through the playoffs. 
            The last one standing wins.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div 
              key={feature.title}
              className="bg-background rounded-2xl p-6 shadow-matchup hover:shadow-card-hover transition-shadow animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <feature.icon className={`w-10 h-10 ${feature.color} mb-4`} />
              <h3 className="font-display text-xl text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
