import { useState } from 'react';
import { UserPlus, RefreshCw, Shuffle, Play, Trash2, Loader2, X } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
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
  const [syncingGames, setSyncingGames] = useState(false);
  const [startingPool, setStartingPool] = useState(false);
  const [deletingPool, setDeletingPool] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const canAddPlayer = !pool.max_players || members.length < pool.max_players;

  const handleAddGuest = async () => {
    if (!guestName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    setAddingGuest(true);
    try {
      const { error } = await supabase.from('pool_members').insert({
        pool_id: pool.id,
        display_name: guestName.trim(),
        is_claimed: false,
        role: 'member',
      });

      if (error) throw error;

      toast.success(`${guestName} added to pool`);
      setGuestName('');
      onMembersChange();
    } catch (error) {
      console.error('Error adding guest:', error);
      toast.error('Failed to add guest');
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

  const handleSyncGames = async () => {
    setSyncingGames(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-odds', {
        body: { competition_key: pool.competition_key },
      });

      if (error) throw error;

      toast.success(`Games synced: ${data?.synced || 0} events updated`);
    } catch (error) {
      console.error('Error syncing games:', error);
      toast.error('Failed to sync games');
    } finally {
      setSyncingGames(false);
    }
  };

  const handleStartPool = async () => {
    if (members.length < 2) {
      toast.error('Need at least 2 players to start');
      return;
    }

    setStartingPool(true);
    try {
      const { error } = await supabase
        .from('pools')
        .update({ status: 'active' })
        .eq('id', pool.id);

      if (error) throw error;

      toast.success('Pool started!');
      onOpenChange(false);
      onMembersChange(); // Refresh pool data
    } catch (error) {
      console.error('Error starting pool:', error);
      toast.error('Failed to start pool');
    } finally {
      setStartingPool(false);
    }
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

  const nonCreatorMembers = members.filter((m) => m.role !== 'creator');

  return (
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
              <div className="flex gap-2">
                <Input
                  placeholder="Guest name..."
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

            {/* Current Members (removable) */}
            {nonCreatorMembers.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Players</h3>
                <div className="space-y-2">
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
            )}

            {/* Pool Actions */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Actions</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleSyncGames}
                  disabled={syncingGames}
                >
                  {syncingGames ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Sync Games
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled
                >
                  <Shuffle className="h-4 w-4 mr-2" />
                  Randomize Teams
                  <span className="ml-auto text-xs text-muted-foreground">Coming soon</span>
                </Button>

                <Button
                  className="w-full justify-start"
                  onClick={handleStartPool}
                  disabled={startingPool || members.length < 2}
                >
                  {startingPool ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Start Pool
                </Button>
                {members.length < 2 && (
                  <p className="text-xs text-muted-foreground">
                    Need at least 2 players to start
                  </p>
                )}
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
  );
}
