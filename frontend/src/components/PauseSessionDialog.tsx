import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Clock, Coffee } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PauseSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPause: (reason?: string) => Promise<void>;
  variant?: 'mobile' | 'admin'; // Variant for different positioning
}

export function PauseSessionDialog({ open, onOpenChange, onPause, variant = 'mobile' }: PauseSessionDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onPause(reason || undefined);
      setReason('');
      onOpenChange(false);
      toast({
        title: 'Session Paused',
        description: 'Your session has been paused. Time will not be counted during the break.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to pause session',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Mobile: bottom sheet style, Admin: centered modal
  const contentClass = variant === 'mobile'
    ? "glass-ios border-primary/30 max-w-md rounded-2xl [&>button]:hidden !left-1/2 !-translate-x-1/2 !top-auto !bottom-0 !translate-y-0 p-4 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
    : "glass-ios border-primary/30 max-w-lg !left-[50%] !top-[50%] !-translate-x-[50%] !-translate-y-[50%] p-4";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentClass}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coffee className="w-5 h-5 text-primary" />
            Pause Session
          </DialogTitle>
          <DialogDescription>
            Pause your gaming session for a break. The timer will stop and billing will be adjusted accordingly.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Taking a 10 min break, Ordering food, etc."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                This information will be included in your receipt for reference.
              </p>
            </div>
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
              <div className="flex items-start gap-2 text-sm">
                <Clock className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Note</p>
                  <p className="text-muted-foreground mt-1">
                    The session timer will stop until you resume. Your billing will be calculated based on actual playing time.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setReason('');
                onOpenChange(false);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="glow" disabled={loading}>
              {loading ? 'Pausing...' : 'Pause Session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
