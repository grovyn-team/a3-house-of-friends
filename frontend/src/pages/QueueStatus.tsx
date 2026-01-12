import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Phone, RefreshCw, X, HelpCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { QueuePositionCard } from "@/components/QueuePositionCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function QueueStatus() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const queueData = location.state || {
    id: "demo",
    name: "Guest",
    phone: "+91 12345 67890",
    service: "playstation" as const,
    joinedAt: new Date(),
    position: 5,
  };

  const [position] = useState(queueData.position);
  const peopleAhead = position - 1;
  const estimatedWait = peopleAhead * 10;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLastUpdated(new Date());
    setIsRefreshing(false);
    toast({
      title: "Queue Updated",
      description: "Your position has been refreshed.",
    });
  };

  const handleCancelBooking = () => {
    toast({
      title: "Booking Cancelled",
      description: "You have been removed from the queue.",
      variant: "destructive",
    });
    navigate("/");
  };

  const formatLastUpdated = () => {
    const seconds = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(prev => prev);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen gradient-mesh">
      <div className="container max-w-lg mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Header */}
          <header className="flex items-center justify-between">
            <Logo size="sm" />
            <Button variant="ghost" size="icon-sm">
              <HelpCircle className="w-5 h-5 text-muted-foreground" />
            </Button>
          </header>

          {/* Main Card */}
          <div className="glass-strong rounded-3xl p-5 md:p-6">
            <QueuePositionCard
              position={position}
              peopleAhead={peopleAhead}
              estimatedWait={estimatedWait}
              service={queueData.service}
              joinedAt={new Date(queueData.joinedAt)}
            />
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              variant="default"
              size="lg"
              className="w-full"
              onClick={() => window.location.href = 'tel:+919876543210'}
            >
              <Phone className="w-5 h-5" />
              Call Cafe
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                size="lg"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              <Button
                variant="outline-destructive"
                size="lg"
                onClick={handleCancelBooking}
              >
                <X className="w-4 h-4" />
                Leave Queue
              </Button>
            </div>
          </div>

          {/* Status Bar */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-secondary/50 rounded-2xl py-3 px-4">
            <span className="w-2 h-2 bg-success rounded-full pulse-glow" />
            <span>Live • Updated {formatLastUpdated()}</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
