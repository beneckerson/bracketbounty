import { BracketView } from '@/components/bracket/BracketView';
import { demoCapturePool, demoAuditLog } from '@/lib/demo-data';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const Demo = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Back button */}
      <div className="fixed top-4 left-4 z-50">
        <Link to="/">
          <Button variant="outline" size="sm" className="gap-2 bg-card shadow-matchup">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </Link>
      </div>

      <BracketView pool={demoCapturePool} auditLogs={demoAuditLog} />
    </div>
  );
};

export default Demo;
