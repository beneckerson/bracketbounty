import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { RosterEditor } from '@/components/admin/RosterEditor';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, ArrowLeft, AlertCircle } from 'lucide-react';
import { COMPETITIONS } from '@/lib/competitions';

export default function Rosters() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [selectedCompetition, setSelectedCompetition] = useState<string>('');
  const [selectedSeason, setSelectedSeason] = useState<string>('');

  // Check if current user is admin
  useEffect(() => {
    async function checkAdminRole() {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) {
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
      } else {
        setIsAdmin(!!data);
      }
    }

    checkAdminRole();
  }, [user]);

  // Set default selection when competition changes
  useEffect(() => {
    if (selectedCompetition) {
      const comp = COMPETITIONS.find(c => c.key === selectedCompetition);
      if (comp) {
        setSelectedSeason(comp.season);
      }
    }
  }, [selectedCompetition]);

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>
                You don't have permission to access this page. Admin privileges are required.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button variant="outline" onClick={() => navigate('/')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Page Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Competition Rosters</h1>
              <p className="text-muted-foreground">
                Manage which teams are available for each competition
              </p>
            </div>
          </div>

          {/* Competition Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Competition</CardTitle>
              <CardDescription>
                Choose a competition and season to manage its roster
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Competition</label>
                  <Select value={selectedCompetition} onValueChange={setSelectedCompetition}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select competition..." />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPETITIONS.map((comp) => (
                        <SelectItem key={comp.key} value={comp.key}>
                          <span className="flex items-center gap-2">
                            <span>{comp.icon}</span>
                            <span>{comp.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-48">
                  <label className="text-sm font-medium mb-2 block">Season</label>
                  <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Season..." />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Generate season options */}
                      <SelectItem value="2024-2025">2024-2025</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2025-2026">2025-2026</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Roster Editor */}
          {selectedCompetition && selectedSeason ? (
            <RosterEditor
              competitionKey={selectedCompetition}
              season={selectedSeason}
            />
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                Select a competition and season above to manage its roster
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
