import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

// Customer Pages
import Landing from "./pages/Landing";
import BookActivity from "./pages/BookActivity";
import Payment from "./pages/Payment";
import SessionTimer from "./pages/SessionTimer";
import ExtendSession from "./pages/ExtendSession";
import Menu from "./pages/Menu";
import Checkout from "./pages/Checkout";
import OrderConfirmation from "./pages/OrderConfirmation";
import Receipt from "./pages/Receipt";
import SmokingRoom from "./pages/SmokingRoom";
import MyBookings from "./pages/MyBookings";
import ViewBooking from "./pages/ViewBooking";
import JoinQueue from "./pages/JoinQueue";
import QueueStatus from "./pages/QueueStatus";

// Admin Pages
import AdminLogin from "./pages/admin/Login";
import AdminRegister from "./pages/admin/Register";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminQueue from "./pages/admin/Queue";
import AdminSessions from "./pages/admin/Sessions";
import SessionHistory from "./pages/admin/SessionHistory";
import OrderHistory from "./pages/admin/OrderHistory";
import Revenue from "./pages/admin/Revenue";
import Inventory from "./pages/admin/Inventory";
import Services from "./pages/admin/Services";
import ApprovalsAndQueue from "./pages/admin/ApprovalsAndQueue";

// Chef Pages
import ChefLogin from "./pages/chef/Login";
import ChefOrders from "./pages/chef/Orders";
import ChefInventory from "./pages/chef/Inventory";

import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const AppContent = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/book" element={<BookActivity />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/session" element={<SessionTimer />} />
        <Route path="/extend" element={<ExtendSession />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order-confirmation" element={<OrderConfirmation />} />
        <Route path="/receipt" element={<Receipt />} />
        <Route path="/smoking-room" element={<SmokingRoom />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/view-booking" element={<ViewBooking />} />
        
        {/* Legacy Routes (for backward compatibility) */}
        <Route path="/join-queue" element={<JoinQueue />} />
        <Route path="/queue-status" element={<QueueStatus />} />

        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/register" element={<AdminRegister />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/queue" element={<AdminQueue />} />
        <Route path="/admin/sessions" element={<AdminSessions />} />
        <Route path="/admin/session-history" element={<SessionHistory />} />
        <Route path="/admin/order-history" element={<OrderHistory />} />
        <Route path="/admin/revenue" element={<Revenue />} />
        <Route path="/admin/inventory" element={<Inventory />} />
        <Route path="/admin/services" element={<Services />} />
        <Route path="/admin/approvals-queue" element={<ApprovalsAndQueue />} />

        <Route path="/chef/login" element={<ChefLogin />} />
        <Route 
          path="/chef/orders" 
          element={
            <ProtectedRoute allowedRoles={['chef', 'admin', 'staff']} redirectTo="/chef/login">
              <ChefOrders />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/chef/inventory" 
          element={
            <ProtectedRoute allowedRoles={['chef', 'admin', 'staff']} redirectTo="/chef/login">
              <ChefInventory />
            </ProtectedRoute>
          } 
        />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      <ThemeToggle />
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ThemeProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AppContent />
        </BrowserRouter>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
