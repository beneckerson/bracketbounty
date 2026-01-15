import { useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook to automatically claim any guest pool memberships when a user authenticates.
 * Checks localStorage for pool_claim_* tokens and links them to the authenticated user.
 */
export function useClaimGuestMemberships(user: User | null) {
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    const claimGuestMemberships = async () => {
      // Find all claim tokens in localStorage
      const claimTokens: { poolId: string; token: string }[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('pool_claim_')) {
          const poolId = key.replace('pool_claim_', '');
          const token = localStorage.getItem(key);
          if (token) {
            claimTokens.push({ poolId, token });
          }
        }
      }

      if (claimTokens.length === 0) return;

      // Claim each membership
      const claimedPools: string[] = [];
      
      for (const { poolId, token } of claimTokens) {
        try {
          const { data, error } = await supabase.rpc('claim_guest_membership', {
            p_claim_token: token,
          });

          if (!error && data && data.length > 0) {
            // Successfully claimed - remove the token from localStorage
            localStorage.removeItem(`pool_claim_${poolId}`);
            localStorage.removeItem(`pool_guest_${poolId}`); // Also clean up guest info
            claimedPools.push(data[0].pool_name);
          } else if (error) {
            console.error(`Failed to claim membership for pool ${poolId}:`, error);
          }
        } catch (err) {
          console.error(`Error claiming membership for pool ${poolId}:`, err);
        }
      }

      // Show toast if we claimed any pools
      if (claimedPools.length > 0) {
        toast({
          title: 'Pools Linked!',
          description: claimedPools.length === 1
            ? `Your membership in "${claimedPools[0]}" has been linked to your account.`
            : `${claimedPools.length} pools have been linked to your account.`,
        });
      }
    };

    claimGuestMemberships();
  }, [user, toast]);
}
