import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Sparkles } from 'lucide-react';
import type { AuditLogEntry } from '@/lib/types';
import { format } from 'date-fns';

interface AuditDrawerProps {
  logs: AuditLogEntry[];
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
            <Sparkles className="w-5 h-5 text-capture" />
            Capture History
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-100px)] mt-4 pr-4">
          <div className="space-y-4">
            {logs.map((log) => (
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
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
