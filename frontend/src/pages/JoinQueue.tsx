import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { ServiceCard } from "@/components/ServiceCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SERVICES, ServiceType } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, ArrowRight, Users, Clock } from "lucide-react";
import { mockQueue } from "@/lib/mock-data";
import { getServiceById } from "@/lib/types";

export default function JoinQueue() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get queue for selected service
  const currentQueue = useMemo(() => {
    if (!selectedService) return [];
    return mockQueue
      .filter(q => q.service === selectedService)
      .sort((a, b) => a.position - b.position)
      .slice(0, 5); // Show top 5
  }, [selectedService]);

  const queueCount = useMemo(() => {
    if (!selectedService) return 0;
    return mockQueue.filter(q => q.service === selectedService).length;
  }, [selectedService]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !phone.trim() || !selectedService) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields and select a service.",
        variant: "destructive",
      });
      return;
    }

    if (phone.length < 10) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid 10-digit phone number.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    await new Promise(resolve => setTimeout(resolve, 1000));

    toast({
      title: "You're in the queue! 🎉",
      description: "We'll notify you when it's your turn.",
    });

    navigate("/queue-status", {
      state: {
        id: "mock-" + Date.now(),
        name,
        phone,
        service: selectedService,
        joinedAt: new Date(),
        position: 5,
      },
    });
  };

  return (
    <div className="min-h-screen gradient-mesh">
      <div className="container max-w-lg mx-auto px-4 py-6 md:py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 md:space-y-8"
        >
          {/* Header */}
          <header className="text-center space-y-3">
            <Logo size="lg" className="justify-center" />
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Skip the wait, join online</span>
            </div>
          </header>

          {/* Welcome Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-3xl p-5 md:p-6 text-center"
          >
            <span className="text-4xl md:text-5xl mb-3 block">👋</span>
            <h2 className="text-xl md:text-2xl font-display font-bold text-foreground mb-2">
              Welcome!
            </h2>
            <p className="text-muted-foreground text-sm md:text-base">
              Join our queue and we'll let you know when your spot is ready. No more waiting around!
            </p>
          </motion.div>

          {/* Form */}
          <motion.form
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            {/* Name Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Your Name
              </label>
              <Input
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                className="h-12"
              />
            </div>

            {/* Phone Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Mobile Number
              </label>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 px-4 bg-secondary rounded-xl text-muted-foreground text-sm shrink-0">
                  <span>🇮🇳</span>
                  <span>+91</span>
                </div>
                <Input
                  type="tel"
                  placeholder="10-digit number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="flex-1 h-12"
                />
              </div>
            </div>

            {/* Service Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                What would you like?
              </label>
              <div className="grid grid-cols-2 gap-3">
                {SERVICES.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    selected={selectedService === service.id}
                    onClick={() => setSelectedService(service.id)}
                  />
                ))}
              </div>
            </div>

            {/* Queue Preview */}
            {selectedService && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="glass rounded-2xl p-4 space-y-3 overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      Current Queue
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {queueCount} {queueCount === 1 ? 'person' : 'people'} waiting
                  </span>
                </div>

                {currentQueue.length > 0 ? (
                  <div className="space-y-2">
                    {currentQueue.map((entry, index) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center justify-between p-2.5 bg-secondary/50 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">#{entry.position}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{entry.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>
                                {Math.floor((Date.now() - new Date(entry.joinedAt).getTime()) / (1000 * 60))} min ago
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                          {getServiceById(entry.service).name}
                        </span>
                      </motion.div>
                    ))}
                    {queueCount > 5 && (
                      <p className="text-xs text-center text-muted-foreground pt-1">
                        +{queueCount - 5} more {queueCount - 5 === 1 ? 'person' : 'people'} in queue
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <span className="text-2xl mb-2 block">🎉</span>
                    <p className="text-sm text-muted-foreground">
                      No one waiting! You'll be first in line.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              variant="glow"
              size="xl"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                "Joining..."
              ) : (
                <>
                  Join Queue
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </Button>

            {/* Terms */}
            <p className="text-center text-xs text-muted-foreground">
              By joining, you agree to our{" "}
              <a href="#" className="text-primary hover:underline">Terms</a>
              {" & "}
              <a href="#" className="text-primary hover:underline">Privacy Policy</a>
            </p>
          </motion.form>
        </motion.div>
      </div>
    </div>
  );
}
