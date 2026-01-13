import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className, size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: 'h-12 w-auto',
    md: 'h-16 w-auto',
    lg: 'h-24 w-auto',
  };

  return (
    <div className={cn("flex items-center", className)}>
      <img 
        src="/a3_house.svg" 
        alt="A3 House of Friends" 
        className={cn(sizeClasses[size])}
      />
    </div>
  );
}
