import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreditCard, X, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/types';

interface QueuePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPay: () => void;
  onExit: () => void;
  activityName: string;
  unitName: string;
  amount: number;
  duration: number;
  loading?: boolean;
}

export function QueuePromptDialog({
  open,
  onOpenChange,
  onPay,
  onExit,
  activityName,
  unitName,
  amount,
  duration,
  loading = false,
}: QueuePromptDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-primary" />
            System Available!
          </DialogTitle>
          <DialogDescription>
            A {activityName} system ({unitName}) is now available for you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Activity:</span>
                <span className="font-medium text-foreground">{activityName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">System:</span>
                <span className="font-medium text-foreground">{unitName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-medium text-foreground">{duration} min</span>
              </div>
              <div className="flex justify-between text-lg font-semibold pt-2 border-t border-primary/20">
                <span>Amount:</span>
                <span className="text-primary">{formatCurrency(amount)}</span>
              </div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground text-center">
            Please proceed to payment to start your session, or exit the queue.
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onExit}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            <X className="w-4 h-4 mr-2" />
            Exit Queue
          </Button>
          <Button
            type="button"
            variant="glow"
            onClick={onPay}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            {loading ? 'Processing...' : 'Proceed to Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
