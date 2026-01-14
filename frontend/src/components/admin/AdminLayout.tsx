import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/admin/StatsCards";
import { queueAPI } from "@/lib/api";
import { 
  LogOut, 
  Menu, 
  X, 
  LayoutDashboard, 
  Users, 
  Clock, 
  History, 
  ShoppingCart, 
  Gamepad2, 
  Package,
  TrendingUp,
  UserPlus
} from "lucide-react";
import { useState, useEffect } from "react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState({ activeNow: 0, todayRevenue: 0, servedToday: 0 });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await queueAPI.getStats();
        setStats({
          activeNow: data.activeNow || 0,
          todayRevenue: data.todayRevenue || 0,
          servedToday: data.servedToday || 0,
        });
      } catch (error) {
        console.error('Failed to load stats:', error);
      }
    };
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const navItems: Array<{ path: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { path: "/admin/queue", label: "Queue", icon: Users },
    { path: "/admin/sessions", label: "Sessions", icon: Clock },
    { path: "/admin/session-history", label: "Session History", icon: History },
    { path: "/admin/order-history", label: "Order History", icon: ShoppingCart },
    { path: "/admin/revenue", label: "Revenue", icon: TrendingUp },
    { path: "/admin/services", label: "Services", icon: Gamepad2 },
    { path: "/admin/inventory", label: "Inventory", icon: Package },
  ];

  const handleLogout = () => {
    window.location.href = "/admin/login";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass-strong border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo size="sm" />
              <span className="hidden sm:inline-block px-2 py-1 bg-primary/20 border border-primary/30 rounded-lg text-xs font-semibold text-primary">
                Admin
              </span>
            </div>

            <div className="hidden lg:flex items-center gap-6">
              <StatsCard label="Active" value={stats.activeNow} />
              <StatsCard label="Revenue" value={stats.todayRevenue.toLocaleString()} prefix="₹" />
              <StatsCard label="Served" value={stats.servedToday} />
            </div>

            <div className="hidden md:flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link to="/admin/register">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Account
                </Link>
              </Button>
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
                      ? "bg-primary text-primary-foreground font-semibold"
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
              <div className="grid grid-cols-3 gap-4">
                <StatsCard label="Active" value={stats.activeNow} />
                <StatsCard label="Revenue" value={`₹${stats.todayRevenue.toLocaleString()}`} />
                <StatsCard label="Served" value={stats.servedToday} />
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/admin/register">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Account
                </Link>
              </Button>
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
