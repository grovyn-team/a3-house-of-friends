import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { 
  LogOut, 
  Menu, 
  X, 
  UtensilsCrossed, 
  Package
} from "lucide-react";
import { useState, useEffect } from "react";
import { ordersAPI } from "@/lib/api";

interface ChefLayoutProps {
  children: React.ReactNode;
}

export function ChefLayout({ children }: ChefLayoutProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingOrders, setPendingOrders] = useState(0);

  useEffect(() => {
    const loadPendingOrders = async () => {
      try {
        const data = await ordersAPI.getPendingOrders();
        setPendingOrders(data.length || 0);
      } catch (error) {
        console.error('Failed to load pending orders:', error);
      }
    };
    loadPendingOrders();
    const interval = setInterval(loadPendingOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const navItems: Array<{ path: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { path: "/chef/orders", label: "Orders", icon: UtensilsCrossed },
    { path: "/chef/inventory", label: "Inventory", icon: Package },
  ];

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    window.location.href = "/admin/login";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass-strong border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo size="sm" />
              <span className="hidden sm:inline-block px-2 py-1 bg-orange-500/20 border border-orange-500/30 rounded-lg text-xs font-semibold text-orange-500">
                Chef
              </span>
              {pendingOrders > 0 && (
                <span className="px-2 py-1 bg-orange-500 text-white rounded-lg text-xs font-semibold">
                  {pendingOrders} Pending
                </span>
              )}
            </div>

            <div className="hidden md:flex items-center gap-2">
              <Button variant="ghost" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        <div className="container mx-auto px-4 border-t border-border/50">
          <nav className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm whitespace-nowrap",
                    isActive
                      ? "bg-orange-500 text-white font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/50 bg-card">
            <div className="container mx-auto px-4 py-4 space-y-4">
              {pendingOrders > 0 && (
                <div className="text-center">
                  <span className="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold">
                    {pendingOrders} Pending Orders
                  </span>
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        )}
      </header>

      <main className="container mx-auto px-4 py-4 md:py-6">
        {children}
      </main>
    </div>
  );
}
