import { BracketView } from '@/components/bracket/BracketView';
import { demoCapturePool, demoAuditLog } from '@/lib/demo-data';

// Demo odds were locked at tournament start
const DEMO_ODDS_UPDATED = new Date('2026-01-10T18:00:00Z');

const Demo = () => {
  return (
    <div className="min-h-screen bg-background">
      <BracketView 
        pool={demoCapturePool} 
        auditLogs={demoAuditLog} 
        oddsLastUpdated={DEMO_ODDS_UPDATED}
      />
    </div>
  );
};

export default Demo;
