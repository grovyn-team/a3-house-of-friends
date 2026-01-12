import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { getServiceById, ServiceType } from "@/lib/types";
import { Clock, Users, Gamepad2, CalendarClock } from "lucide-react";

interface QueuePositionCardProps {
  position: number;
  peopleAhead: number;
  estimatedWait: number;
  service: ServiceType;
  joinedAt: Date;
}

export function QueuePositionCard({
  position,
  peopleAhead,
  estimatedWait,
  service,
  joinedAt,
}: QueuePositionCardProps) {
  const serviceInfo = getServiceById(service);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-6"
    >
      {/* Position Display */}
      <div className="text-center py-6 md:py-8">
        <p className="text-muted-foreground uppercase tracking-widest text-xs font-medium mb-2">
          Your Position
        </p>
        <motion.div
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="relative inline-block"
        >
          <span className="font-display text-7xl md:text-9xl font-bold text-primary">
            #{position}
          </span>
        </motion.div>
        <p className="text-foreground/70 text-sm md:text-base mt-4">
          We'll notify you when it's your turn
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatBox
          icon={<Users className="w-4 h-4" />}
          label="Ahead of you"
          value={peopleAhead.toString()}
          accent
        />
        <StatBox
          icon={<Clock className="w-4 h-4" />}
          label="Est. wait"
          value={`${estimatedWait} min`}
        />
        <StatBox
          icon={<Gamepad2 className="w-4 h-4" />}
          label="Service"
          value={serviceInfo.name}
        />
        <StatBox
          icon={<CalendarClock className="w-4 h-4" />}
          label="Joined at"
          value={formatTime(joinedAt)}
        />
      </div>
    </motion.div>
  );
}

interface StatBoxProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}

function StatBox({ icon, label, value, accent }: StatBoxProps) {
  return (
    <div className={cn(
      "glass rounded-2xl p-4",
      accent && "border-primary/30"
    )}>
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn(
        "font-display text-lg md:text-xl font-semibold",
        accent ? "text-primary" : "text-foreground"
      )}>
        {value}
      </p>
    </div>
  );
}
