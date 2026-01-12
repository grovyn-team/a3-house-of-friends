import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { TrendingUp, Ticket } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: string | number;
  prefix?: string;
  className?: string;
}

export function StatsCard({ label, value, prefix, className }: StatsCardProps) {
  return (
    <div className={cn("text-center", className)}>
      <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
      <p className="text-foreground font-bold text-lg md:text-xl">
        {prefix}{value}
      </p>
    </div>
  );
}

interface RevenueCardProps {
  total: number;
  breakdown: {
    label: string;
    amount: number;
  }[];
}

export function RevenueCard({ total, breakdown }: RevenueCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass rounded-2xl p-4 md:p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-5 h-5 text-success" />
        <h3 className="font-bold text-foreground text-sm md:text-base">Today's Revenue</h3>
      </div>
      <p className="text-3xl md:text-4xl font-display font-bold text-primary mb-4">
        ₹{total.toLocaleString()}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {breakdown.map((item, index) => (
          <div
            key={index}
            className="bg-secondary/50 rounded-xl p-2 md:p-3"
          >
            <p className="text-muted-foreground text-xs">{item.label}</p>
            <p className="text-foreground font-bold text-sm md:text-base">₹{item.amount.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

interface QueuePreviewProps {
  count: number;
  items: {
    name: string;
    service: string;
    position: number;
  }[];
  onViewAll?: () => void;
}

export function QueuePreviewCard({ count, items, onViewAll }: QueuePreviewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 }}
      className="glass rounded-2xl p-4 md:p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <Ticket className="w-5 h-5 text-success" />
        <h3 className="font-bold text-foreground text-sm md:text-base">Queue ({count})</h3>
      </div>
      <div className="space-y-2">
        {items.slice(0, 3).map((item, index) => (
          <div
            key={index}
            className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
          >
            <div>
              <p className="font-medium text-foreground text-sm">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.service}</p>
            </div>
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">#{item.position}</span>
            </div>
          </div>
        ))}
      </div>
      {count > 3 && (
        <button
          onClick={onViewAll}
          className="w-full mt-3 py-2 bg-primary/10 text-primary rounded-xl font-medium text-sm hover:bg-primary/20 transition-colors"
        >
          View All
        </button>
      )}
    </motion.div>
  );
}
