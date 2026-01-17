import { useState } from 'react';
import { UserPlus, Shuffle, Trash2, Loader2, X, Crown, Rocket } from 'lucide-react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { TeamAssignmentDialog } from './TeamAssignmentDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PoolData {
  id: string;
  name: string;
  competition_key: string;
  status: 'draft' | 'lobby' | 'active' | 'completed';
  max_players: number | null;
}

interface PoolMember {
  id: string;
  display_name: string;
  role: 'creator' | 'member';
  is_claimed: boolean;
  user_id: string | null;
}

interface TeamAssignment {
  member_id: string;
  member_name: string;
  team_code: string;
  team_name: string;
  team_abbreviation: string;
}

interface ManagePoolDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pool: PoolData;
  members: PoolMember[];
  onMembersChange: () => void;
  onPoolDelete: () => void;
}

export function ManagePoolDrawer({
  open,
  onOpenChange,
  pool,
  members,
  onMembersChange,
  onPoolDelete,
}: ManagePoolDrawerProps) {
  const [guestName, setGuestName] = useState('');
  const [addingGuest, setAddingGuest] = useState(false);
  const [startingPool, setStartingPool] = useState(false);
  const [deletingPool, setDeletingPool] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  
  // Team assignment dialog state
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignment[]>([]);

  const canAddPlayer = !pool.max_players || members.length < pool.max_players;

  const handleAddGuest = async () => {
    if (!guestName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    setAddingGuest(true);
    try {
      const guestDisplayName = guestName.trim();
      const { error } = await supabase.from('pool_members').insert({
        pool_id: pool.id,
        display_name: guestDisplayName,
        is_claimed: false,
        role: 'member',
      });

      if (error) throw error;

      // Log member joined event
      await supabase.from('audit_log').insert({
        pool_id: pool.id,
        action_type: 'member_joined',
        payload: { display_name: guestDisplayName },
      });

      toast.success(`${guestDisplayName} added to pool`);
      setGuestName('');
      onMembersChange();
    } catch (error: any) {
      console.error('Error adding guest:', error);
      toast.error(error?.message || 'Failed to add guest');
    } finally {
      setAddingGuest(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    setRemovingMemberId(memberId);
    try {
      const { error } = await supabase
        .from('pool_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast.success(`${memberName} removed from pool`);
      onMembersChange();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleStartPool = async () => {
    if (members.length < 2) {
      toast.error('Need at least 2 players to start');
      return;
    }

    setStartingPool(true);
    try {
      // Auto-sync games first
      toast.info('Syncing games...');
      const { error: syncError } = await supabase.functions.invoke('sync-odds', {
        body: { competition_key: pool.competition_key },
      });

      if (syncError) {
        console.error('Sync error (continuing anyway):', syncError);
      }

      // Then start the pool
      const { data, error } = await supabase.functions.invoke('start-pool', {
        body: { pool_id: pool.id },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      // Store assignments and show dialog
      if (data?.assignments && data.assignments.length > 0) {
        setTeamAssignments(data.assignments);
        onOpenChange(false); // Close the drawer
        setAssignmentDialogOpen(true); // Show assignment dialog
      } else {
        toast.success('Pool started! Teams assigned and bracket created.');
        onOpenChange(false);
        onMembersChange();
      }
    } catch (error: any) {
      console.error('Error starting pool:', error);
      toast.error(error?.message || 'Failed to start pool');
    } finally {
      setStartingPool(false);
    }
  };

  const handleViewBracket = () => {
    setAssignmentDialogOpen(false);
    onMembersChange(); // This will refresh the pool data and show bracket
  };

  const handleDeletePool = async () => {
    setDeletingPool(true);
    try {
      const { error } = await supabase
        .from('pools')
        .delete()
        .eq('id', pool.id);

      if (error) throw error;

      toast.success('Pool deleted');
      onPoolDelete();
    } catch (error) {
      console.error('Error deleting pool:', error);
      toast.error('Failed to delete pool');
    } finally {
      setDeletingPool(false);
    }
  };

  const commissioner = members.find((m) => m.role === 'creator');
  const nonCreatorMembers = members.filter((m) => m.role !== 'creator');

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <div className="mx-auto w-full max-w-md overflow-y-auto">
            <DrawerHeader>
              <DrawerTitle className="font-bebas tracking-wide text-xl">
                Manage Pool
              </DrawerTitle>
              <DrawerDescription>
                Manage players and pool settings
              </DrawerDescription>
            </DrawerHeader>

            <div className="px-4 pb-4 space-y-6">
              {/* Add Guest Player */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Add Guest Player
                </h3>
                <p className="text-xs text-muted-foreground">
                  Add a placeholder for someone who hasn't signed up yet. They can claim their spot later.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter guest's name..."
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    disabled={!canAddPlayer || addingGuest}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddGuest()}
                  />
                  <Button
                    onClick={handleAddGuest}
                    disabled={!canAddPlayer || addingGuest || !guestName.trim()}
                  >
                    {addingGuest ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Add'
                    )}
                  </Button>
                </div>
                {!canAddPlayer && (
                  <p className="text-xs text-muted-foreground">
                    Pool is full ({pool.max_players} players max)
                  </p>
                )}
              </div>

              {/* All Players */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">
                  Players ({members.length}{pool.max_players ? `/${pool.max_players}` : ''})
                </h3>
                <div className="space-y-2">
                  {/* Commissioner first */}
                  {commissioner && (
                    <div
                      className="flex items-center justify-between p-2 bg-primary/10 border border-primary/20 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center">
                          <Crown className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-sm font-medium">{commissioner.display_name}</span>
                        <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          Commissioner
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Other members */}
                  {nonCreatorMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-xs font-medium text-primary">
                            {member.display_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm">{member.display_name}</span>
                        {!member.is_claimed && (
                          <span className="text-xs text-muted-foreground">(Guest)</span>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveMember(member.id, member.display_name)}
                        disabled={removingMemberId === member.id}
                      >
                        {removingMemberId === member.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Start Pool */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Start Pool</h3>
                <div className="space-y-3">
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-primary mb-1">
                      <Shuffle className="h-4 w-4" />
                      <span className="font-medium">Random Team Assignment</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Teams will be randomly shuffled and distributed evenly among all players.
                    </p>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleStartPool}
                    disabled={startingPool || members.length < 2}
                  >
                    {startingPool ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Rocket className="h-4 w-4 mr-2" />
                    )}
                    Start Pool & Assign Teams
                  </Button>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    {members.length < 2 
                      ? 'Need at least 2 players to start'
                      : 'Games will be synced automatically and the bracket will be created.'}
                  </p>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="space-y-3 pt-4 border-t border-border">
                <h3 className="text-sm font-medium text-destructive">Danger Zone</h3>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-destructive hover:text-destructive border-destructive/30 hover:border-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Pool
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete "{pool.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. All pool data, members, and matchups will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeletePool}
                        disabled={deletingPool}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deletingPool ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Team Assignment Results Dialog */}
      <TeamAssignmentDialog
        open={assignmentDialogOpen}
        onOpenChange={setAssignmentDialogOpen}
        assignments={teamAssignments}
        onViewBracket={handleViewBracket}
      />
    </>
  );
}
