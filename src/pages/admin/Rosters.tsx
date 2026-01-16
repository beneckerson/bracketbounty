import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { RosterEditor } from '@/components/admin/RosterEditor';
import { EventsManager } from '@/components/admin/EventsManager';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, ArrowLeft, AlertCircle, Plus, RefreshCw, Loader2, Users, Calendar } from 'lucide-react';
import { COMPETITIONS } from '@/lib/competitions';
import { toast } from 'sonner';

interface CompetitionSeason {
  id: string;
  competition_key: string;
  season: string;
  is_active: boolean;
}

export default function Rosters() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [selectedCompetition, setSelectedCompetition] = useState<string>('');
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [seasons, setSeasons] = useState<CompetitionSeason[]>([]);
  const [loadingSeasons, setLoadingSeasons] = useState(false);
  const [newSeasonDialogOpen, setNewSeasonDialogOpen] = useState(false);
  const [newSeasonValue, setNewSeasonValue] = useState('');
  const [creatingNewSeason, setCreatingNewSeason] = useState(false);
  const [syncingTeams, setSyncingTeams] = useState(false);

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

  // Fetch seasons when competition changes
  useEffect(() => {
    async function fetchSeasons() {
      if (!selectedCompetition) {
        setSeasons([]);
        return;
      }

      setLoadingSeasons(true);
      const { data, error } = await supabase
        .from('competition_seasons')
        .select('*')
        .eq('competition_key', selectedCompetition)
        .order('season', { ascending: false });

      if (error) {
        console.error('Error fetching seasons:', error);
        toast.error('Failed to load seasons');
      } else {
        setSeasons(data || []);
        // Auto-select active season or first available
        const activeSeason = data?.find(s => s.is_active);
        if (activeSeason) {
          setSelectedSeason(activeSeason.season);
        } else if (data && data.length > 0) {
          setSelectedSeason(data[0].season);
        } else {
          setSelectedSeason('');
        }
      }
      setLoadingSeasons(false);
    }

    fetchSeasons();
  }, [selectedCompetition]);

  const handleCreateSeason = async () => {
    if (!newSeasonValue.trim() || !selectedCompetition) return;

    setCreatingNewSeason(true);
    const { error } = await supabase
      .from('competition_seasons')
      .insert({
        competition_key: selectedCompetition,
        season: newSeasonValue.trim(),
        is_active: false,
      });

    if (error) {
      console.error('Error creating season:', error);
      toast.error('Failed to create season');
    } else {
      toast.success('Season created');
      setNewSeasonDialogOpen(false);
      setNewSeasonValue('');
      // Refresh seasons
      const { data } = await supabase
        .from('competition_seasons')
        .select('*')
        .eq('competition_key', selectedCompetition)
        .order('season', { ascending: false });
      setSeasons(data || []);
      if (data && data.length > 0) {
        setSelectedSeason(newSeasonValue.trim());
      }
    }
    setCreatingNewSeason(false);
  };

  const handleToggleActive = async (seasonId: string, newValue: boolean) => {
    if (newValue) {
      // First, deactivate all other seasons for this competition
      await supabase
        .from('competition_seasons')
        .update({ is_active: false })
        .eq('competition_key', selectedCompetition);
    }

    const { error } = await supabase
      .from('competition_seasons')
      .update({ is_active: newValue })
      .eq('id', seasonId);

    if (error) {
      console.error('Error updating season:', error);
      toast.error('Failed to update season');
    } else {
      toast.success(newValue ? 'Season set as active' : 'Season deactivated');
      // Refresh seasons
      const { data } = await supabase
        .from('competition_seasons')
        .select('*')
        .eq('competition_key', selectedCompetition)
        .order('season', { ascending: false });
      setSeasons(data || []);
    }
  };

  const handleSyncTeams = async () => {
    const comp = COMPETITIONS.find(c => c.key === selectedCompetition);
    if (!comp) return;

    // Map competition to league
    const leagueMap: Record<string, string> = {
      nfl_playoffs: 'NFL',
      cfp: 'CFB',
      nba_playoffs: 'NBA',
      nhl_playoffs: 'NHL',
      mlb_playoffs: 'MLB',
    };
    const league = leagueMap[selectedCompetition];
    if (!league) {
      toast.error('Unknown league for this competition');
      return;
    }

    setSyncingTeams(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      const response = await supabase.functions.invoke('sync-teams', {
        body: { league },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      toast.success(`Synced ${result.totalTeams} teams (${result.inserted} new, ${result.updated} updated)`);
    } catch (error: any) {
      console.error('Error syncing teams:', error);
      toast.error(error.message || 'Failed to sync teams');
    }
    setSyncingTeams(false);
  };

  const currentSeasonData = seasons.find(s => s.season === selectedSeason);

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
      <main className="container mx-auto px-4 pt-24 pb-8">
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

          {/* Competition & Season Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Competition</CardTitle>
              <CardDescription>
                Choose a competition and season to manage its roster
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  {loadingSeasons ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <div className="flex gap-2">
                      <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Season..." />
                        </SelectTrigger>
                        <SelectContent>
                          {seasons.map((s) => (
                            <SelectItem key={s.id} value={s.season}>
                              {s.season} {s.is_active && '(Active)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Dialog open={newSeasonDialogOpen} onOpenChange={setNewSeasonDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="icon" disabled={!selectedCompetition}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add New Season</DialogTitle>
                            <DialogDescription>
                              Create a new season for {COMPETITIONS.find(c => c.key === selectedCompetition)?.name}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-4">
                            <Label htmlFor="season">Season</Label>
                            <Input
                              id="season"
                              placeholder="e.g., 2025-2026 or 2026"
                              value={newSeasonValue}
                              onChange={(e) => setNewSeasonValue(e.target.value)}
                            />
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setNewSeasonDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleCreateSeason} disabled={creatingNewSeason || !newSeasonValue.trim()}>
                              {creatingNewSeason && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Create
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>
              </div>

              {/* Season Actions */}
              {selectedCompetition && selectedSeason && currentSeasonData && (
                <div className="flex flex-wrap items-center gap-4 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="active-toggle"
                      checked={currentSeasonData.is_active}
                      onCheckedChange={(checked) => handleToggleActive(currentSeasonData.id, checked)}
                    />
                    <Label htmlFor="active-toggle" className="text-sm">
                      Active Season (default for new pools)
                    </Label>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncTeams}
                    disabled={syncingTeams}
                  >
                    {syncingTeams ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Sync Teams from API
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs for Teams and Events */}
          {selectedCompetition && selectedSeason ? (
            <Tabs defaultValue="teams" className="space-y-4">
              <TabsList>
                <TabsTrigger value="teams" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Teams
                </TabsTrigger>
                <TabsTrigger value="events" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Events
                </TabsTrigger>
              </TabsList>
              <TabsContent value="teams">
                <RosterEditor
                  competitionKey={selectedCompetition}
                  season={selectedSeason}
                />
              </TabsContent>
              <TabsContent value="events">
                <EventsManager
                  competitionKey={selectedCompetition}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                Select a competition and season above to manage its roster and events
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
