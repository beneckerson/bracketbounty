import { BracketView } from '@/components/bracket/BracketView';
import { demoCapturePool, demoAuditLog } from '@/lib/demo-data';

const Demo = () => {
  return (
    <div className="min-h-screen bg-background">
      <BracketView pool={demoCapturePool} auditLogs={demoAuditLog} />
    </div>
  );
};

export default Demo;
