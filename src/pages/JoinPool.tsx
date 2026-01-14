import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ArrowLeft, Users, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getCompetition } from '@/lib/competitions';

const joinSchema = z.object({
  code: z.string().trim().min(1, 'Please enter an invite code').max(20),
  displayName: z.string().trim().min(1, 'Please enter your name').max(50).optional(),
});

type JoinFormValues = z.infer<typeof joinSchema>;

export default function JoinPool() {
  const { code: urlCode } = useParams<{ code: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [pool, setPool] = useState<any>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const form = useForm<JoinFormValues>({
    resolver: zodResolver(joinSchema),
    defaultValues: { code: urlCode || '', displayName: '' },
  });

  const codeValue = form.watch('code');

  useEffect(() => {
    if (codeValue.length >= 6) {
      lookupPool(codeValue);
    } else {
      setPool(null);
    }
  }, [codeValue]);

  const lookupPool = async (code: string) => {
    setLookingUp(true);
    setNotFound(false);
    
    const { data, error } = await supabase
      .rpc('lookup_pool_by_invite_code', { code });
    
    if (error || !data || data.length === 0) {
      setPool(null);
      setNotFound(true);
    } else {
      setPool(data[0]);
      setNotFound(false);
    }
    setLookingUp(false);
  };

  const onSubmit = async (values: JoinFormValues) => {
    if (!pool) return;
    setIsLoading(true);

    try {
      let displayName = values.displayName;
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', user.id)
          .single();
        displayName = profile?.display_name || user.email?.split('@')[0] || 'Player';
      }

      const { error } = await supabase.from('pool_members').insert({
        pool_id: pool.id,
        user_id: user?.id || null,
        display_name: displayName || 'Guest',
        role: 'member',
        is_claimed: !!user,
      });

      if (error) throw error;

      toast({ title: 'Joined!', description: `You've joined ${pool.name}` });
      navigate(`/pool/${pool.id}`);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to join pool', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const competition = pool ? getCompetition(pool.competition_key) : null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-md mx-auto">
          <Button variant="ghost" onClick={() => navigate('/')} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>

          <div className="bg-card border border-border rounded-2xl p-6">
            <h1 className="text-2xl font-bebas text-foreground tracking-wide mb-2">JOIN A POOL</h1>
            <p className="text-muted-foreground mb-6">Enter the invite code shared by your friend</p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invite Code</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., abc123xy" className="text-center text-lg tracking-widest uppercase" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {lookingUp && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>}

                {notFound && !lookingUp && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
                    <p className="text-sm text-destructive font-medium">No pool found with this code</p>
                    <p className="text-xs text-muted-foreground mt-1">Check the code and try again.</p>
                  </div>
                )}

                {pool && (
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{competition?.icon || '🏆'}</span>
                      <div>
                        <p className="font-medium">{pool.name}</p>
                        <p className="text-xs text-muted-foreground">{competition?.name} • {pool.season}</p>
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {pool.max_players} players</span>
                      <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> {pool.buyin_amount_cents ? `$${pool.buyin_amount_cents/100}` : 'Free'}</span>
                    </div>
                  </div>
                )}

                {!user && pool && (
                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Name</FormLabel>
                        <FormControl><Input placeholder="Enter your name" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <Button type="submit" className="w-full" disabled={!pool || isLoading}>
                  {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Joining...</> : 'Join Pool'}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </main>
    </div>
  );
}
