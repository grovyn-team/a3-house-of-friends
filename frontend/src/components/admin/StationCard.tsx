import { cn } from "@/lib/utils";
import { Station, getServiceById } from "@/lib/types";
import { Phone, Plus, Receipt, Pause, Play, Gamepad2, Car, Coffee, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface StationCardProps {
  station: Station;
  session?: any; // Full session object with pause info
  onExtend?: () => void;
  onEndSession?: () => void;
  onAssign?: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

// Get icon component based on activity type
const getActivityIcon = (type: string, size: 'sm' | 'lg' = 'sm') => {
  const iconClass = size === 'lg' ? "h-12 w-12 md:h-16 md:w-16" : "h-5 w-5 md:h-6 md:w-6";
  const typeLower = type.toLowerCase();
  
  if (typeLower.includes('playstation') || typeLower === 'playstation') {
    return <Gamepad2 className={iconClass} />;
  } else if (typeLower.includes('racing') || typeLower === 'racing') {
    return <Car className={iconClass} />;
  } else if (typeLower.includes('snooker')) {
    return <CircleDot className={iconClass} />;
  } else if (typeLower.includes('smoking')) {
    return <Coffee className={iconClass} />;
  } else {
    return <Coffee className={iconClass} />;
  }
};

export function StationCard({ station, session, onExtend, onEndSession, onAssign, onPause, onResume }: StationCardProps) {
  const serviceInfo = getServiceById(station.type);
  const [elapsedTime, setElapsedTime] = useState("0:00:00");
  const [currentBill, setCurrentBill] = useState(0);
  const isPaused = session?.status === 'paused' || !!session?.currentPauseStart;

  useEffect(() => {
    if (station.status !== 'occupied' || !station.currentCustomer) return;

    const updateTimer = () => {
      if (isPaused && session?.currentPauseStart) {
        // When paused, calculate elapsed until pause start
        const start = new Date(station.currentCustomer!.startTime).getTime();
        const pauseStart = new Date(session.currentPauseStart).getTime();
        const diff = pauseStart - start;

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setElapsedTime(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        const hoursElapsed = diff / (1000 * 60 * 60);
        setCurrentBill(Math.ceil(hoursElapsed * station.rate));
      } else {
        // Normal timer calculation excluding paused duration
        const start = new Date(station.currentCustomer!.startTime).getTime();
        const now = Date.now();
        const totalPausedMs = (session?.totalPausedDuration || 0) * 60 * 1000;
        const diff = now - start - totalPausedMs;

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setElapsedTime(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        const hoursElapsed = diff / (1000 * 60 * 60);
        setCurrentBill(Math.ceil(hoursElapsed * station.rate));
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [station, session, isPaused]);

  const isOccupied = station.status === 'occupied';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "glass rounded-2xl overflow-hidden transition-all",
        isOccupied && "border-warning/50"
      )}
    >
      {/* Header */}
      <div className="p-3 md:p-4 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="text-primary">
            {getActivityIcon(station.type)}
          </div>
          <h3 className="font-bold text-base md:text-lg">{station.name}</h3>
        </div>
        <span
          className={cn(
            "px-2 py-1 rounded-full text-xs font-bold uppercase",
            isOccupied
              ? "bg-warning/15 text-warning"
              : "bg-success/15 text-success"
          )}
        >
          {isOccupied ? "Busy" : "Free"}
        </span>
      </div>

      {/* Content */}
      <div className="p-3 md:p-4">
        {isOccupied && station.currentCustomer ? (
          <>
            {/* Customer Info */}
            <div className="mb-3">
              <p className="font-semibold text-foreground text-sm md:text-base">{station.currentCustomer.name}</p>
              <a
                href={`tel:${station.currentCustomer.phone}`}
                className="text-primary text-xs md:text-sm flex items-center gap-1 hover:underline"
              >
                <Phone className="h-3 w-3" />
                {station.currentCustomer.phone}
              </a>
            </div>

            {/* Session Info */}
            <div className="bg-secondary/50 rounded-xl p-3 mb-3">
              <div className="flex items-center justify-center gap-2 mb-1">
                <p className="text-center text-muted-foreground text-xs uppercase tracking-wide">
                  Duration
                </p>
                {isPaused && (
                  <span className="px-2 py-0.5 rounded-full bg-warning/20 text-warning text-xs font-medium flex items-center gap-1">
                    <Pause className="w-3 h-3" />
                    Paused
                  </span>
                )}
              </div>
              <p className={cn(
                "text-center font-display text-2xl md:text-3xl font-bold",
                isPaused ? "text-muted-foreground" : "text-accent"
              )}>
                {elapsedTime}
              </p>
              <div className="flex justify-between mt-2 text-xs md:text-sm">
                <span className="text-muted-foreground">Rate</span>
                <span className="text-foreground font-medium">₹{station.rate}/hr</span>
              </div>
              <div className="flex justify-between text-xs md:text-sm">
                <span className="text-muted-foreground">Bill</span>
                <span className="text-primary font-bold">₹{currentBill}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {isPaused ? (
                <Button
                  variant="glow"
                  size="sm"
                  className="flex-1 text-xs md:text-sm bg-success hover:bg-success/90"
                  onClick={onResume}
                >
                  <Play className="h-4 w-4" />
                  Resume
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 text-xs md:text-sm"
                  onClick={onPause}
                >
                  <Pause className="h-4 w-4" />
                  Pause
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                className="flex-1 text-xs md:text-sm"
                onClick={onExtend}
                disabled={isPaused}
              >
                <Plus className="h-4 w-4" />
                30 min
              </Button>
              <Button
                variant="accent"
                size="sm"
                className="flex-1 text-xs md:text-sm"
                onClick={onEndSession}
              >
                <Receipt className="h-4 w-4" />
                Bill
              </Button>
            </div>
          </>
        ) : (
          <div className="py-6 md:py-8 text-center">
            <div className="flex justify-center mb-2 text-primary">
              {getActivityIcon(station.type, 'lg')}
            </div>
            <p className="text-muted-foreground text-sm mb-4">Ready for next customer</p>
            <Button
              variant="glow"
              size="default"
              className="w-full"
              onClick={onAssign}
            >
              Assign
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
