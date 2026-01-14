import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Loader2, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/Header';
import { PoolCard } from '@/components/pool/PoolCard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface PoolWithMemberCount {
  id: string;
  name: string;
  competition_key: string;
  season: string;
  status: 'draft' | 'lobby' | 'active' | 'completed';
  mode: 'capture' | 'standard';
  buyin_amount_cents: number | null;
  max_players: number | null;
  invite_code: string;
  created_at: string;
  created_by: string | null;
  memberCount?: number;
}

export default function MyPools() {
  const { user } = useAuth();
  const [pools, setPools] = useState<PoolWithMemberCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPools() {
      if (!user) return;

      try {
        // Get all pools where user is a member
        const { data: memberships, error: membershipError } = await supabase
          .from('pool_members')
          .select('pool_id')
          .eq('user_id', user.id);

        if (membershipError) throw membershipError;

        const poolIds = memberships?.map((m) => m.pool_id) || [];

        if (poolIds.length === 0) {
          setPools([]);
          setLoading(false);
          return;
        }

        // Get pool details
        const { data: poolsData, error: poolsError } = await supabase
          .from('pools')
          .select('*')
          .in('id', poolIds)
          .order('created_at', { ascending: false });

        if (poolsError) throw poolsError;

        // Get member counts for each pool
        const poolsWithCounts = await Promise.all(
          (poolsData || []).map(async (pool) => {
            const { count } = await supabase
              .from('pool_members')
              .select('*', { count: 'exact', head: true })
              .eq('pool_id', pool.id);

            return {
              ...pool,
              memberCount: count || 0,
            } as PoolWithMemberCount;
          })
        );

        setPools(poolsWithCounts);
      } catch (error) {
        console.error('Error fetching pools:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPools();
  }, [user]);

  const createdPools = pools.filter((p) => p.created_by === user?.id);
  const joinedPools = pools.filter((p) => p.created_by !== user?.id);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bebas text-foreground tracking-wide">MY POOLS</h1>
              <p className="text-muted-foreground">Manage and view your playoff pools</p>
            </div>
            <Button asChild>
              <Link to="/create-pool">
                <Plus className="h-4 w-4 mr-2" />
                Create Pool
              </Link>
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : pools.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-display text-foreground mb-2">No pools yet</h2>
              <p className="text-muted-foreground mb-6">
                Create your first pool or join one with an invite code
              </p>
              <div className="flex gap-3 justify-center">
                <Button asChild>
                  <Link to="/create-pool">Create a Pool</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/join">Join with Code</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Created Pools */}
              {createdPools.length > 0 && (
                <section>
                  <h2 className="font-display text-lg text-foreground mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full" />
                    Pools You Created
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {createdPools.map((pool) => (
                      <PoolCard key={pool.id} pool={pool} isCreator />
                    ))}
                  </div>
                </section>
              )}

              {/* Joined Pools */}
              {joinedPools.length > 0 && (
                <section>
                  <h2 className="font-display text-lg text-foreground mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-accent rounded-full" />
                    Pools You Joined
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {joinedPools.map((pool) => (
                      <PoolCard key={pool.id} pool={pool} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
