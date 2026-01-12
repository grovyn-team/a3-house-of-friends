import { cn } from "@/lib/utils";
import { Service } from "@/lib/types";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface ServiceCardProps {
  service: Service;
  selected?: boolean;
  onClick?: () => void;
}

export function ServiceCard({ service, selected, onClick }: ServiceCardProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 p-4 md:p-5 rounded-2xl border-2 transition-all duration-200",
        "glass-ios",
        selected
          ? "border-primary/40 shadow-glow-subtle"
          : "border-primary/20 hover:border-primary/30 hover:shadow-glow-subtle"
      )}
    >
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center"
        >
          <Check className="w-3 h-3 text-primary-foreground" />
        </motion.div>
      )}
      <span className="text-3xl md:text-4xl">{service.icon}</span>
      <div className="text-center">
        <p className="font-semibold text-foreground text-sm md:text-base">
          {service.name}
        </p>
        <p className={cn(
          "text-xs md:text-sm mt-0.5 font-medium",
          service.rate > 0 ? "text-primary" : "text-success"
        )}>
          {service.rate > 0 ? `₹${service.rate}/hr` : 'Free'}
        </p>
      </div>
    </motion.button>
  );
}
