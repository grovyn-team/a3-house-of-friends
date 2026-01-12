import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Trophy, Users, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sessionsAPI } from '@/lib/api';

interface WinnerSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  players: Array<{ name: string; phone?: string; hasVoted?: boolean; voteFor?: string }>;
  currentPlayerName?: string;
  winner?: string;
  onWinnerSelected?: () => void;
  variant?: 'user' | 'admin';
}

export function WinnerSelectionDialog({
  open,
  onOpenChange,
  sessionId,
  players,
  currentPlayerName,
  winner,
  onWinnerSelected,
  variant = 'user',
}: WinnerSelectionDialogProps) {
  const { toast } = useToast();
  const [selectedWinner, setSelectedWinner] = useState<string>(winner || '');
  const [loading, setLoading] = useState(false);
  const [votingComplete, setVotingComplete] = useState(!!winner);

  useEffect(() => {
    if (winner) {
      setSelectedWinner(winner);
      setVotingComplete(true);
    }
  }, [winner]);

  const handleVote = async () => {
    if (!selectedWinner) {
      toast({
        title: 'Select Winner',
        description: 'Please select the winner before voting.',
        variant: 'destructive',
      });
      return;
    }

    if (!currentPlayerName && variant === 'user') {
      toast({
        title: 'Error',
        description: 'Player name not found.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      await sessionsAPI.voteWinner(
        sessionId,
        selectedWinner,
        currentPlayerName || 'admin'
      );

      toast({
        title: 'Vote Submitted',
        description: `You voted for ${selectedWinner} as the winner!`,
      });

      // Check if all players have voted
      const updatedVotes = players.map(p => 
        p.name === currentPlayerName ? { ...p, hasVoted: true, voteFor: selectedWinner } : p
      );
      const allVoted = updatedVotes.every(p => p.hasVoted);

      if (allVoted) {
        setVotingComplete(true);
        toast({
          title: 'All Votes In!',
          description: `The winner has been determined: ${selectedWinner}`,
        });
        onWinnerSelected?.();
        setTimeout(() => {
          onOpenChange(false);
        }, 2000);
      } else {
        onOpenChange(false);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit vote.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSelect = async () => {
    if (!selectedWinner) {
      toast({
        title: 'Select Winner',
        description: 'Please select the winner.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      await sessionsAPI.selectWinner(sessionId, selectedWinner, 'admin');

      toast({
        title: 'Winner Selected',
        description: `${selectedWinner} has been selected as the winner by admin.`,
      });

      setVotingComplete(true);
      onWinnerSelected?.();
      setTimeout(() => {
        onOpenChange(false);
      }, 2000);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to select winner.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const hasCurrentPlayerVoted = currentPlayerName 
    ? players.find(p => p.name === currentPlayerName)?.hasVoted 
    : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-ios border-primary/30 sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Trophy className="w-5 h-5 text-primary" />
            {votingComplete ? 'Winner Selected!' : 'Select the Winner'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {variant === 'admin'
              ? 'Select who won the challenge. The winner will pay for everyone.'
              : votingComplete
              ? `The winner is ${winner}. They will pay for everyone's session.`
              : hasCurrentPlayerVoted
              ? 'You have already voted. Waiting for other players...'
              : 'Vote for who won the challenge. The winner will pay for everyone.'}
          </DialogDescription>
        </DialogHeader>

        {winner ? (
          <div className="py-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                <Trophy className="w-10 h-10 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground mb-1">{winner}</p>
                <p className="text-muted-foreground">is the winner!</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  {winner} will pay for all {players.length} players' sessions.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Players</Label>
              <RadioGroup value={selectedWinner} onValueChange={setSelectedWinner}>
                <div className="space-y-2">
                  {players.map((player, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 rounded-lg border border-border p-3 hover:bg-secondary/50"
                    >
                      <RadioGroupItem
                        value={player.name}
                        id={`player-${index}`}
                        disabled={variant === 'user' && hasCurrentPlayerVoted}
                      />
                      <Label
                        htmlFor={`player-${index}`}
                        className="flex-1 cursor-pointer flex items-center justify-between"
                      >
                        <span className="font-medium text-foreground">{player.name}</span>
                        {variant === 'admin' && player.hasVoted && (
                          <span className="text-xs text-muted-foreground">
                            Voted for: {player.voteFor}
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {variant === 'admin' && (
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                <p className="text-sm text-foreground">
                  <Users className="w-4 h-4 inline mr-2" />
                  Votes: {players.filter(p => p.hasVoted).length} / {players.length}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!votingComplete && !hasCurrentPlayerVoted && variant === 'user' && (
            <Button
              onClick={handleVote}
              disabled={!selectedWinner || loading}
              variant="glow"
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting Vote...
                </>
              ) : (
                'Submit Vote'
              )}
            </Button>
          )}
          {variant === 'admin' && !winner && (
            <Button
              onClick={handleAdminSelect}
              disabled={!selectedWinner || loading}
              variant="glow"
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Selecting Winner...
                </>
              ) : (
                'Select Winner'
              )}
            </Button>
          )}
          {votingComplete && (
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="w-full"
            >
              Continue to Payment
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
