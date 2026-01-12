import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className, size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: 'text-lg md:text-xl',
    md: 'text-xl md:text-2xl',
    lg: 'text-2xl md:text-4xl',
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className={cn("font-display font-bold text-primary", sizeClasses[size])}>
        A3
      </span>
      <span className={cn("font-display font-medium text-foreground", sizeClasses[size])}>
        House of Friends
      </span>
    </div>
  );
}
