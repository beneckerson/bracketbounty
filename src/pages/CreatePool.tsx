import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Loader2, Copy, Check, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Header } from '@/components/layout/Header';
import { CompetitionSelector } from '@/components/pool/CompetitionSelector';
import { getCompetition, CompetitionConfig } from '@/lib/competitions';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const poolSchema = z.object({
  competitionKey: z.string().min(1, 'Please select a competition'),
  name: z.string().trim().min(1, 'Pool name is required').max(50, 'Pool name must be less than 50 characters'),
  mode: z.enum(['standard', 'capture']),
  scoringRule: z.enum(['straight', 'ats']),
  buyinAmountCents: z.number().min(0).max(100000),
  maxPlayers: z.number().min(2).max(32),
  teamsPerPlayer: z.number().min(1).max(4),
  allocationMethod: z.enum(['random', 'draft']),
  payoutNote: z.string().max(500).optional(),
});

type PoolFormValues = z.infer<typeof poolSchema>;

const STEPS = [
  { id: 1, name: 'Competition', description: 'Choose your playoff' },
  { id: 2, name: 'Settings', description: 'Pool rules' },
  { id: 3, name: 'Players', description: 'Buy-in & size' },
  { id: 4, name: 'Review', description: 'Confirm details' },
];

export default function CreatePool() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedCompetition, setSelectedCompetition] = useState<CompetitionConfig | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdPool, setCreatedPool] = useState<{ id: string; inviteCode: string } | null>(null);
  const [copied, setCopied] = useState(false);
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<PoolFormValues>({
    resolver: zodResolver(poolSchema),
    defaultValues: {
      competitionKey: '',
      name: '',
      mode: 'capture',
      scoringRule: 'straight',
      buyinAmountCents: 0,
      maxPlayers: 8,
      teamsPerPlayer: 1,
      allocationMethod: 'random',
      payoutNote: '',
    },
  });

  const handleCompetitionSelect = (comp: CompetitionConfig) => {
    setSelectedCompetition(comp);
    form.setValue('competitionKey', comp.key);
    form.setValue('maxPlayers', Math.min(8, comp.maxPlayers));
    if (!comp.atsEnabled) {
      form.setValue('scoringRule', 'straight');
    }
    if (!comp.captureEnabled) {
      form.setValue('mode', 'standard');
    }
  };

  const nextStep = () => {
    if (currentStep === 1 && !selectedCompetition) {
      toast({ title: 'Please select a competition', variant: 'destructive' });
      return;
    }
    if (currentStep === 2) {
      const name = form.getValues('name');
      if (!name.trim()) {
        form.setError('name', { message: 'Pool name is required' });
        return;
      }
    }
    setCurrentStep((s) => Math.min(s + 1, 4));
  };

  const prevStep = () => setCurrentStep((s) => Math.max(s - 1, 1));

  const onSubmit = async (values: PoolFormValues) => {
    if (!user || !selectedCompetition) return;

    setIsSubmitting(true);

    try {
      // Create the pool
      const { data: pool, error: poolError } = await supabase
        .from('pools')
        .insert({
          name: values.name,
          competition_key: values.competitionKey,
          season: selectedCompetition.season,
          mode: values.mode,
          scoring_rule: values.scoringRule,
          buyin_amount_cents: values.buyinAmountCents,
          max_players: values.maxPlayers,
          teams_per_player: values.teamsPerPlayer,
          allocation_method: values.allocationMethod,
          payout_note: values.payoutNote || null,
          created_by: user.id,
          status: 'lobby',
        })
        .select('id, invite_code')
        .single();

      if (poolError) throw poolError;

      // Get user's display name from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();

      // Add creator as first member
      const { error: memberError } = await supabase
        .from('pool_members')
        .insert({
          pool_id: pool.id,
          user_id: user.id,
          display_name: profile?.display_name || user.email?.split('@')[0] || 'Creator',
          role: 'creator',
          is_claimed: true,
        });

      if (memberError) throw memberError;

      setCreatedPool({ id: pool.id, inviteCode: pool.invite_code });
      setShowSuccess(true);
    } catch (error) {
      console.error('Error creating pool:', error);
      toast({
        title: 'Error',
        description: 'Failed to create pool. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyInviteCode = () => {
    if (createdPool) {
      navigator.clipboard.writeText(createdPool.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const values = form.watch();
  const buyinDisplay = values.buyinAmountCents > 0 
    ? `$${(values.buyinAmountCents / 100).toFixed(0)}` 
    : 'Free';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {STEPS.map((step, idx) => (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors ${
                        currentStep >= step.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {step.id}
                    </div>
                    <span className="text-xs mt-1 text-muted-foreground hidden sm:block">{step.name}</span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`w-12 sm:w-20 h-0.5 mx-2 transition-colors ${
                        currentStep > step.id ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="bg-card border border-border rounded-2xl p-6 sm:p-8">
                {/* Step 1: Competition */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-display text-foreground mb-2">Choose Your Competition</h2>
                      <p className="text-muted-foreground">Select the playoff format for your pool</p>
                    </div>
                    <CompetitionSelector
                      value={values.competitionKey}
                      onChange={handleCompetitionSelect}
                    />
                  </div>
                )}

                {/* Step 2: Settings */}
                {currentStep === 2 && selectedCompetition && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-display text-foreground mb-2">Pool Settings</h2>
                      <p className="text-muted-foreground">Configure your pool rules</p>
                    </div>

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pool Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Office NFL Pool 2025" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedCompetition.captureEnabled && (
                      <FormField
                        control={form.control}
                        name="mode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Game Mode</FormLabel>
                            <FormControl>
                              <RadioGroup
                                value={field.value}
                                onValueChange={field.onChange}
                                className="grid grid-cols-2 gap-4"
                              >
                                <div>
                                  <RadioGroupItem value="capture" id="capture" className="peer sr-only" />
                                  <Label
                                    htmlFor="capture"
                                    className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                                  >
                                    <span className="text-2xl mb-2">🏴‍☠️</span>
                                    <span className="font-medium">Capture Mode</span>
                                    <span className="text-xs text-muted-foreground text-center mt-1">
                                      Winners capture loser's teams
                                    </span>
                                  </Label>
                                </div>
                                <div>
                                  <RadioGroupItem value="standard" id="standard" className="peer sr-only" />
                                  <Label
                                    htmlFor="standard"
                                    className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                                  >
                                    <span className="text-2xl mb-2">🏆</span>
                                    <span className="font-medium">Standard Mode</span>
                                    <span className="text-xs text-muted-foreground text-center mt-1">
                                      Points for each win
                                    </span>
                                  </Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {selectedCompetition.atsEnabled && (
                      <FormField
                        control={form.control}
                        name="scoringRule"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Scoring Rule</FormLabel>
                            <FormControl>
                              <RadioGroup
                                value={field.value}
                                onValueChange={field.onChange}
                                className="grid grid-cols-2 gap-4"
                              >
                                <div>
                                  <RadioGroupItem value="straight" id="straight" className="peer sr-only" />
                                  <Label
                                    htmlFor="straight"
                                    className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                                  >
                                    <span className="font-medium">Straight Up</span>
                                    <span className="text-xs text-muted-foreground text-center mt-1">
                                      Winner takes all
                                    </span>
                                  </Label>
                                </div>
                                <div>
                                  <RadioGroupItem value="ats" id="ats" className="peer sr-only" />
                                  <Label
                                    htmlFor="ats"
                                    className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                                  >
                                    <span className="font-medium">Against the Spread</span>
                                    <span className="text-xs text-muted-foreground text-center mt-1">
                                      Point spread decides
                                    </span>
                                  </Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                )}

                {/* Step 3: Players & Buy-in */}
                {currentStep === 3 && selectedCompetition && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-display text-foreground mb-2">Players & Buy-in</h2>
                      <p className="text-muted-foreground">Set up your pool size and entry fee</p>
                    </div>

                    <FormField
                      control={form.control}
                      name="buyinAmountCents"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Buy-in Amount (optional)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                              <Input
                                type="number"
                                min={0}
                                max={1000}
                                placeholder="0"
                                className="pl-8"
                                value={field.value / 100 || ''}
                                onChange={(e) => field.onChange(Number(e.target.value) * 100)}
                              />
                            </div>
                          </FormControl>
                          <FormDescription>Leave at $0 for a free pool</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="maxPlayers"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Players</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={2}
                                max={selectedCompetition.maxPlayers}
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="teamsPerPlayer"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Teams per Player</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                max={4}
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="allocationMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Team Allocation</FormLabel>
                          <FormControl>
                            <RadioGroup
                              value={field.value}
                              onValueChange={field.onChange}
                              className="grid grid-cols-2 gap-4"
                            >
                              <div>
                                <RadioGroupItem value="random" id="random" className="peer sr-only" />
                                <Label
                                  htmlFor="random"
                                  className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                                >
                                  <span className="text-2xl mb-2">🎲</span>
                                  <span className="font-medium">Random</span>
                                  <span className="text-xs text-muted-foreground text-center mt-1">
                                    Teams assigned randomly
                                  </span>
                                </Label>
                              </div>
                              <div>
                                <RadioGroupItem value="draft" id="draft" className="peer sr-only" />
                                <Label
                                  htmlFor="draft"
                                  className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                                >
                                  <span className="text-2xl mb-2">📋</span>
                                  <span className="font-medium">Draft</span>
                                  <span className="text-xs text-muted-foreground text-center mt-1">
                                    Players pick teams
                                  </span>
                                </Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="payoutNote"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payout Structure (optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="e.g., Winner takes 70%, runner-up 20%, third 10%"
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Step 4: Review */}
                {currentStep === 4 && selectedCompetition && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-display text-foreground mb-2">Review Your Pool</h2>
                      <p className="text-muted-foreground">Confirm everything looks good</p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-muted-foreground">Competition</span>
                        <span className="font-medium">{selectedCompetition.name}</span>
                      </div>
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-muted-foreground">Pool Name</span>
                        <span className="font-medium">{values.name || '—'}</span>
                      </div>
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-muted-foreground">Mode</span>
                        <span className="font-medium capitalize">{values.mode}</span>
                      </div>
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-muted-foreground">Scoring</span>
                        <span className="font-medium">{values.scoringRule === 'ats' ? 'Against the Spread' : 'Straight Up'}</span>
                      </div>
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-muted-foreground">Buy-in</span>
                        <span className="font-medium">{buyinDisplay}</span>
                      </div>
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-muted-foreground">Max Players</span>
                        <span className="font-medium">{values.maxPlayers}</span>
                      </div>
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-muted-foreground">Teams per Player</span>
                        <span className="font-medium">{values.teamsPerPlayer}</span>
                      </div>
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-muted-foreground">Allocation</span>
                        <span className="font-medium capitalize">{values.allocationMethod}</span>
                      </div>
                      {values.payoutNote && (
                        <div className="py-3">
                          <span className="text-muted-foreground block mb-1">Payout Note</span>
                          <span className="text-sm">{values.payoutNote}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between mt-8 pt-6 border-t border-border">
                  {currentStep > 1 ? (
                    <Button type="button" variant="ghost" onClick={prevStep}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                  ) : (
                    <Button type="button" variant="ghost" onClick={() => navigate('/')}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  )}

                  {currentStep < 4 ? (
                    <Button type="button" onClick={nextStep}>
                      Continue
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Pool'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </Form>
        </div>
      </main>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <PartyPopper className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-center text-2xl">Pool Created!</DialogTitle>
            <DialogDescription className="text-center">
              Share this invite code with your friends to join the pool.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
            <code className="flex-1 text-2xl font-mono font-bold text-center tracking-widest">
              {createdPool?.inviteCode}
            </code>
            <Button size="icon" variant="ghost" onClick={copyInviteCode}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex flex-col gap-2 mt-4">
            <Button onClick={() => navigate(`/pool/${createdPool?.id}`)}>
              Go to Pool
            </Button>
            <Button variant="outline" onClick={() => navigate('/my-pools')}>
              View All Pools
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
