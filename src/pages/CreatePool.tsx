import { useState, useEffect } from 'react';
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
import { TeamSelector } from '@/components/pool/TeamSelector';
import { AllocationCalculator } from '@/components/pool/AllocationCalculator';
import { getCompetition, CompetitionConfig } from '@/lib/competitions';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const poolSchema = z.object({
  competitionKey: z.string().min(1, 'Please select a competition'),
  name: z.string().trim().min(1, 'Pool name is required').max(50, 'Pool name must be less than 50 characters'),
  mode: z.enum(['standard', 'capture']),
  selectedTeams: z.array(z.string()).min(2, 'Select at least 2 teams'),
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
  { id: 3, name: 'Teams', description: 'Select teams' },
  { id: 4, name: 'Players', description: 'Buy-in & size' },
  { id: 5, name: 'Review', description: 'Confirm details' },
];

export default function CreatePool() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedCompetition, setSelectedCompetition] = useState<CompetitionConfig | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdPool, setCreatedPool] = useState<{ id: string; inviteCode: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<PoolFormValues>({
    resolver: zodResolver(poolSchema),
    defaultValues: {
      competitionKey: '',
      name: '',
      mode: 'capture',
      selectedTeams: [],
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
    form.setValue('selectedTeams', []); // Reset teams when competition changes
    form.setValue('maxPlayers', Math.min(8, comp.maxPlayers));
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
    if (currentStep === 3) {
      const teams = form.getValues('selectedTeams');
      if (teams.length < 2) {
        toast({ title: 'Please select at least 2 teams', variant: 'destructive' });
        return;
      }
    }
    setCurrentStep((s) => Math.min(s + 1, 5));
  };

  const prevStep = () => setCurrentStep((s) => Math.max(s - 1, 1));

  const onSubmit = async (values: PoolFormValues) => {
    if (!user || !selectedCompetition) return;

    setIsSubmitting(true);

    try {
      // Create the pool
      // Derive scoring_rule from mode: capture = ats, standard = straight
      const scoringRule = values.mode === 'capture' ? 'ats' : 'straight';
      
      const { data: pool, error: poolError } = await supabase
        .from('pools')
        .insert({
          name: values.name,
          competition_key: values.competitionKey,
          season: selectedCompetition.season,
          mode: values.mode,
          scoring_rule: scoringRule,
          buyin_amount_cents: values.buyinAmountCents,
          max_players: values.maxPlayers,
          teams_per_player: values.teamsPerPlayer,
          allocation_method: values.allocationMethod,
          payout_note: values.payoutNote || null,
          selected_teams: values.selectedTeams,
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

  const copyShareLink = () => {
    if (createdPool) {
      const shareUrl = `${window.location.origin}/join/${createdPool.inviteCode}`;
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const values = form.watch();
  const buyinDisplay = values.buyinAmountCents > 0 
    ? `$${(values.buyinAmountCents / 100).toFixed(0)}` 
    : 'Free';

  // Calculate allocation status
  const teamCount = values.selectedTeams.length;
  const playerCount = values.maxPlayers;

  // Auto-sync teamsPerPlayer when the math divides evenly
  useEffect(() => {
    if (teamCount > 0 && playerCount > 0 && teamCount % playerCount === 0) {
      const computed = Math.floor(teamCount / playerCount);
      form.setValue('teamsPerPlayer', computed);
    }
  }, [teamCount, playerCount, form]);

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
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-medium text-sm sm:text-base transition-colors ${
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
                      className={`w-6 sm:w-12 h-0.5 mx-1 sm:mx-2 transition-colors ${
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
            <form 
              onSubmit={(e) => e.preventDefault()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && currentStep !== 5) {
                  e.preventDefault();
                }
              }}
            >
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
                                className="grid grid-cols-1 gap-4"
                              >
                                <div>
                                  <RadioGroupItem value="capture" id="capture" className="peer sr-only" />
                                  <Label
                                    htmlFor="capture"
                                    className="flex flex-col rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                                  >
                                    <div className="flex items-center gap-3 mb-2">
                                      <span className="text-2xl">🏴‍☠️</span>
                                      <span className="font-medium text-lg">Capture Mode</span>
                                    </div>
                                    <span className="text-sm text-muted-foreground mb-2">
                                      Spreads determine winners. If a team covers the spread, they advance. Underdogs can capture favored teams who don't cover!
                                    </span>
                                    <span className="text-xs text-primary/80 bg-primary/5 px-2 py-1 rounded inline-block w-fit">
                                      Example: If KC is -7 vs MIA, and KC wins by 6, MIA covers and captures KC.
                                    </span>
                                  </Label>
                                </div>
                                <div>
                                  <RadioGroupItem value="standard" id="standard" className="peer sr-only" />
                                  <Label
                                    htmlFor="standard"
                                    className="flex flex-col rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                                  >
                                    <div className="flex items-center gap-3 mb-2">
                                      <span className="text-2xl">🏆</span>
                                      <span className="font-medium text-lg">Standard Mode</span>
                                    </div>
                                    <span className="text-sm text-muted-foreground mb-2">
                                      Straight-up wins. Whoever wins the game advances — no spreads involved.
                                    </span>
                                    <span className="text-xs text-primary/80 bg-primary/5 px-2 py-1 rounded inline-block w-fit">
                                      Example: If KC beats MIA 24-21, KC's owner keeps their team and advances.
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

                {/* Step 3: Select Teams */}
                {currentStep === 3 && selectedCompetition && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-display text-foreground mb-2">Select Teams</h2>
                      <p className="text-muted-foreground">
                        Choose which teams will be part of your pool's drawing
                      </p>
                    </div>

                    <TeamSelector
                      competitionKey={values.competitionKey}
                      season={selectedCompetition.season}
                      selectedTeams={values.selectedTeams}
                      onChange={(teams) => form.setValue('selectedTeams', teams)}
                    />
                  </div>
                )}

                {/* Step 4: Players & Buy-in */}
                {currentStep === 4 && selectedCompetition && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-display text-foreground mb-2">Players & Buy-in</h2>
                      <p className="text-muted-foreground">Set up your pool size and entry fee</p>
                    </div>

                    {/* Number of Players with inline teams badge */}
                    <FormField
                      control={form.control}
                      name="maxPlayers"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>Number of Players</FormLabel>
                            {teamCount > 0 && playerCount > 0 && (
                              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                                {Math.floor(teamCount / playerCount)} team{Math.floor(teamCount / playerCount) !== 1 ? 's' : ''} each
                              </span>
                            )}
                          </div>
                          <FormControl>
                            <Input
                              type="number"
                              min={2}
                              max={selectedCompetition.maxPlayers}
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            {teamCount} teams selected
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Allocation Calculator - shows quick picks and warnings */}
                    {teamCount > 0 && (
                      <AllocationCalculator
                        teamCount={teamCount}
                        playerCount={playerCount}
                        onPlayerCountChange={(count) => form.setValue('maxPlayers', count)}
                      />
                    )}

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

                {/* Step 5: Review */}
                {currentStep === 5 && selectedCompetition && (
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
                        <span className="font-medium">
                          {values.mode === 'capture' ? 'Capture Mode (Spreads)' : 'Standard Mode (Straight-up)'}
                        </span>
                      </div>
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-muted-foreground">Teams Selected</span>
                        <span className="font-medium">{values.selectedTeams.length} teams</span>
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
                        <span className="font-medium">
                          {Math.floor(values.selectedTeams.length / values.maxPlayers)} team{Math.floor(values.selectedTeams.length / values.maxPlayers) !== 1 ? 's' : ''} each
                          {values.selectedTeams.length % values.maxPlayers !== 0 && (
                            <span className="text-amber-500 ml-1">
                              ({values.selectedTeams.length % values.maxPlayers} extra)
                            </span>
                          )}
                        </span>
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

                  {currentStep < 5 ? (
                    <Button type="button" onClick={nextStep}>
                      Continue
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <Button 
                      type="button" 
                      disabled={isSubmitting}
                      onClick={() => form.handleSubmit(onSubmit)()}
                    >
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
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <PartyPopper className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-center text-2xl">Pool Created!</DialogTitle>
            <DialogDescription className="text-center">
              Share this link with your friends to join the pool.
            </DialogDescription>
          </DialogHeader>
          
          {/* Primary: Share Link */}
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <code className="flex-1 text-sm font-mono break-all leading-relaxed">
              {window.location.origin}/join/{createdPool?.inviteCode}
            </code>
            <Button size="icon" variant="ghost" className="flex-shrink-0" onClick={copyShareLink}>
              {copiedLink ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          {/* Secondary: Code */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>Or share the code:</span>
            <code className="font-mono font-bold tracking-widest">{createdPool?.inviteCode}</code>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={copyInviteCode}>
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
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
