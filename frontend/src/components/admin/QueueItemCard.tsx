import { cn } from "@/lib/utils";
import { QueueEntry, getServiceById } from "@/lib/types";
import { Phone, CheckCircle, X, Clock, UtensilsCrossed, ChefHat, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface QueueItemCardProps {
  entry: QueueEntry;
  onAssign?: () => void;
  onRemove?: () => void;
}

export function QueueItemCard({ entry, onAssign, onRemove }: QueueItemCardProps) {
  const serviceInfo = getServiceById(entry.service);

  const getWaitTime = () => {
    const diff = Date.now() - new Date(entry.joinedAt).getTime();
    return Math.floor(diff / (1000 * 60));
  };

  const formatJoinedTime = () => {
    return new Date(entry.joinedAt).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const peopleBehind = 5 - entry.position;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "glass rounded-2xl overflow-hidden",
        entry.status === 'next' && "border-primary/50"
      )}
    >
      {/* Header */}
      <div className="p-3 md:p-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm md:text-base">#{entry.position}</span>
          </div>
          <div>
            <h3 className="font-bold text-sm md:text-base text-foreground">{entry.name}</h3>
            <a
              href={`tel:${entry.phone}`}
              className="text-primary text-xs md:text-sm flex items-center gap-1 hover:underline"
            >
              <Phone className="h-3 w-3" />
              {entry.phone}
            </a>
          </div>
        </div>
        <span
          className={cn(
            "px-2 py-1 rounded-full text-xs font-bold uppercase shrink-0 flex items-center gap-1",
            entry.type === 'order' && (entry as any).orderStatus
              ? (entry as any).orderStatus === 'preparing'
                ? "bg-blue-500/15 text-blue-500"
                : (entry as any).orderStatus === 'ready'
                ? "bg-success/15 text-success"
                : (entry as any).orderStatus === 'served'
                ? "bg-muted/15 text-muted-foreground"
                : "bg-warning/15 text-warning"
              : entry.status === 'next'
              ? "bg-primary/15 text-primary"
              : "bg-warning/15 text-warning"
          )}
        >
          {entry.type === 'order' && (entry as any).orderStatus ? (
            <>
              {(entry as any).orderStatus === 'preparing' && <ChefHat className="h-3 w-3" />}
              {(entry as any).orderStatus === 'ready' && <Package className="h-3 w-3" />}
              {(entry as any).orderStatus === 'served' && <CheckCircle className="h-3 w-3" />}
              {(entry as any).orderStatus === 'pending' && <Clock className="h-3 w-3" />}
              {(entry as any).orderStatus === 'preparing' ? 'Preparing' :
               (entry as any).orderStatus === 'ready' ? 'Ready' :
               (entry as any).orderStatus === 'served' ? 'Served' : 'Pending'}
            </>
          ) : (
            entry.status === 'next' ? 'Next' : 'Waiting'
          )}
        </span>
      </div>

      {/* Details */}
      <div className="px-3 md:px-4 pb-3 md:pb-4">
        <div className="bg-secondary/50 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs md:text-sm">
          <div>
            <p className="text-muted-foreground">Service</p>
            <p className="font-medium text-foreground flex items-center gap-1">
              {entry.type === 'order' && <UtensilsCrossed className="h-3 w-3" />}
              {serviceInfo.name}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Wait
            </p>
            <p className="font-medium text-foreground">{getWaitTime()} min</p>
          </div>
          {entry.type === 'order' && (entry as any).itemCount ? (
            <>
              <div>
                <p className="text-muted-foreground">Items</p>
                <p className="font-medium text-foreground">{(entry as any).itemCount} items</p>
              </div>
              <div>
                <p className="text-muted-foreground">Amount</p>
                <p className="font-medium text-foreground">₹{(entry as any).amount || 0}</p>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-muted-foreground">Joined</p>
                <p className="font-medium text-foreground">{formatJoinedTime()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Behind</p>
                <p className="font-medium text-foreground">{Math.max(0, peopleBehind)}</p>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <Button
            variant="glow"
            size="sm"
            className="flex-1"
            onClick={onAssign}
            disabled={entry.type === 'order' && (entry as any).orderStatus === 'served'}
          >
            <CheckCircle className="h-4 w-4" />
            {entry.type === 'order' && (entry as any).orderStatus
              ? (entry as any).orderStatus === 'pending' ? 'Start Preparing' :
                (entry as any).orderStatus === 'preparing' ? 'Mark Ready' :
                (entry as any).orderStatus === 'ready' ? 'Mark Served' :
                'Assign'
              : 'Assign'}
          </Button>
          <Button
            variant="outline-destructive"
            size="icon-sm"
            onClick={onRemove}
            disabled={entry.type === 'order' && (entry as any).orderStatus === 'served'}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
