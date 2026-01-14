import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { authAPI } from "@/lib/api";
import { Lock, User, ChefHat } from "lucide-react";

export default function ChefLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!username || !password) {
      toast({
        title: "Missing Credentials",
        description: "Please enter username and password.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const response = await authAPI.login(username, password);
      
      if (!['chef', 'admin'].includes(response.user.role)) {
        authAPI.logout();
        toast({
          title: "Access Denied",
          description: "This login is for chefs and admins only. Staff members should use the admin login.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: "Welcome!",
        description: `Login successful.`,
      });

      navigate("/chef/orders");
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-mesh flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="glass-strong rounded-3xl p-6 md:p-8">
          <div className="text-center mb-6">
            <Logo size="md" className="justify-center mb-4" />
            <div className="flex items-center justify-center gap-2 mb-2">
              <ChefHat className="w-6 h-6 text-orange-500" />
              <h1 className="text-xl font-bold text-foreground">Chef Login</h1>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Sign in to manage orders and inventory
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Username</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="glow"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Admin?{" "}
              <Link
                to="/admin/login"
                className="text-primary hover:underline font-medium"
              >
                Admin Login
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Protected area. Authorized personnel only.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
