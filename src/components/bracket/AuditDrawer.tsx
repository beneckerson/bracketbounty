import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { History, Clock, ChevronDown } from 'lucide-react';
import type { AuditLogEntry } from '@/lib/types';
import { format } from 'date-fns';

interface AuditDrawerProps {
  logs: AuditLogEntry[];
}

interface Assignment {
  member_name: string;
  team_abbreviation: string;
}

function OriginalDraw({ assignments }: { assignments: Assignment[] }) {
  const [open, setOpen] = useState(false);

  // Group by member
  const grouped = assignments.reduce<Record<string, string[]>>((acc, a) => {
    const name = a.member_name || 'Unknown';
    if (!acc[name]) acc[name] = [];
    acc[name].push(a.team_abbreviation);
    return acc;
  }, {});

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary font-medium mt-2 hover:underline">
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        {open ? 'Hide' : 'View'} Original Draw
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-1.5 text-xs">
          {Object.entries(grouped).map(([name, teams]) => (
            <div key={name} className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-foreground min-w-[60px]">{name}:</span>
              {teams.map((abbr) => (
                <span
                  key={abbr}
                  className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-mono font-medium text-muted-foreground"
                >
                  {abbr}
                </span>
              ))}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AuditDrawer({ logs }: AuditDrawerProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="w-4 h-4" />
          History
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display text-2xl">
            <Clock className="w-5 h-5 text-primary" />
            Pool History
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-100px)] mt-4 pr-4">
          <div className="space-y-4">
            {logs.map((log) => {
              const isTeamsAssigned = log.actionType === 'teams_assigned';
              const assignments = isTeamsAssigned
                ? (log.payload?.assignments as Assignment[] | undefined)
                : undefined;

              return (
                <div
                  key={log.id}
                  className="relative pl-6 pb-4 border-l-2 border-muted last:border-transparent"
                >
                  <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-capture" />
                  <div className="bg-card rounded-lg p-3 shadow-matchup">
                    <p className="text-sm font-medium">{log.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(log.createdAt, 'MMM d, yyyy • h:mm a')}
                    </p>
                    {assignments && assignments.length > 0 && (
                      <OriginalDraw assignments={assignments} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
