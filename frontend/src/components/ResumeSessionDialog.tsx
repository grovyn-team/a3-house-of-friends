import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Play, Clock } from 'lucide-react';
import { formatDuration } from '@/lib/types';

interface ResumeSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResume: () => Promise<void>;
  pausedDuration?: number; // in minutes
  loading?: boolean;
  variant?: 'mobile' | 'admin'; // Variant for different positioning
}

export function ResumeSessionDialog({ 
  open, 
  onOpenChange, 
  onResume, 
  pausedDuration = 0,
  loading = false,
  variant = 'mobile'
}: ResumeSessionDialogProps) {
  const handleResume = async () => {
    await onResume();
    onOpenChange(false);
  };

  // Mobile: bottom sheet style, Admin: centered modal
  const contentClass = variant === 'mobile'
    ? "glass-ios border-primary/30 max-w-md rounded-2xl [&>button]:hidden !left-1/2 !-translate-x-1/2 !top-auto !bottom-0 !translate-y-0 p-4 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
    : "glass-ios border-primary/30 max-w-lg p-4";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentClass}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="w-5 h-5 text-success" />
            Resume Session
          </DialogTitle>
          <DialogDescription>
            Ready to continue? Your session timer will resume and billing will continue.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {pausedDuration > 0 && (
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Break Duration</p>
                  <p className="text-muted-foreground">
                    You were on break for {formatDuration(pausedDuration)}
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="text-center text-sm text-muted-foreground">
            Click &quot;Resume Session&quot; to continue playing.
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            type="button" 
            variant="glow" 
            onClick={handleResume}
            disabled={loading}
            className="bg-success hover:bg-success/90"
          >
            {loading ? 'Resuming...' : 'Resume Session'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
