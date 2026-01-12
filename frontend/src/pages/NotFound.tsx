import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Home, ShieldQuestion } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen gradient-mesh flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <Logo size="md" className="justify-center mb-6" />
        
        <div className="glass rounded-3xl p-8 mb-6">
          <ShieldQuestion className="w-16 h-16 text-primary mx-auto mb-4" />
          <h1 className="text-4xl font-display font-bold text-primary mb-2">404</h1>
          <p className="text-lg text-foreground mb-1">Page Not Found</p>
          <p className="text-muted-foreground text-sm">
            The page you're looking for doesn't exist.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="glow" size="lg">
            <Link to="/">
              <Home className="h-4 w-4" />
              Go Home
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link to="/admin/login">
              Admin Login
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
