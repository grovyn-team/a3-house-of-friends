import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Receipt, Calendar, CheckCircle, XCircle, Trash2, ChefHat, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/Logo';
import { sessionsAPI, ordersAPI } from '@/lib/api';
import { formatCurrency, formatDuration } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useBookingHistory, BookingHistoryItem } from '@/hooks/useBookingHistory';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useConfirmation } from '@/components/ui/confirmation-dialog';

export default function MyBookings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { confirm, ConfirmationDialog } = useConfirmation();
  const { history, clearHistory, updateBooking } = useBookingHistory();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { on, isConnected, emit, joinRoom } = useWebSocket({ namespace: 'customer' });

  useEffect(() => {
    loadBookings();
  }, [history]);

  useEffect(() => {
    if (!isConnected) return;

    if (history.length > 0 && history[0].customerPhone) {
      const normalizedPhone = history[0].customerPhone.replace(/\D/g, '');
      emit('register_customer', { phone: normalizedPhone });
    }

    history.forEach(booking => {
      if (booking.type === 'order' && booking.orderId) {
        joinRoom(`order:${booking.orderId}`);
      } else if (booking.type === 'reservation' && booking.id) {
        joinRoom(`reservation:${booking.id}`);
      } else if (booking.sessionId) {
        joinRoom(`session:${booking.sessionId}`);
      }
    });

    const cleanupOrder = on('order_status_update', (data: any) => {
      const booking = history.find(h => h.orderId === data.orderId || h.id === data.orderId);
      if (booking) {
        updateBooking(booking.id, { status: data.status });
        loadBookings();
        toast({
          title: data.status === 'preparing' ? 'Order Being Prepared!' :
                 data.status === 'ready' ? 'Order Ready!' :
                 data.status === 'served' ? 'Order Served!' :
                 data.status === 'cancelled' ? 'Order Cancelled' : 'Order Updated',
          description: data.message || 'Your order status has been updated.',
          variant: data.status === 'cancelled' ? 'destructive' : 'default',
        });
      }
    });

    const cleanupBookingApproved = on('booking_approved', (data: any) => {
      const booking = history.find(h => 
        h.id === data.reservationId || 
        h.reservationId === data.reservationId
      );
      if (booking) {
        updateBooking(booking.id, { 
          status: 'payment_confirmed',
          ...(data.sessionId && { sessionId: data.sessionId })
        });
        loadBookings(); // Refresh to show updated status
        toast({
          title: 'Booking Approved!',
          description: data.message || 'Your booking has been approved and session has started.',
          variant: 'default',
        });
      }
    });

    const cleanupBooking = on('booking_status_update', (data: any) => {
      const booking = history.find(h => 
        h.id === data.reservationId || 
        h.sessionId === data.sessionId ||
        h.reservationId === data.reservationId ||
        (data.reservationId && h.id === data.reservationId)
      );
      if (booking) {
        updateBooking(booking.id, { 
          status: data.status === 'confirmed' ? 'payment_confirmed' : data.status,
          ...(data.sessionId && { sessionId: data.sessionId })
        });
        loadBookings(); // Refresh to show updated status
        toast({
          title: data.status === 'confirmed' || data.status === 'payment_confirmed' ? 'Booking Confirmed!' : 'Booking Updated',
          description: data.message || 'Your booking status has been updated.',
          variant: data.status === 'cancelled' ? 'destructive' : 'default',
        });
      }
    });

    const cleanupSession = on('session_status_update', (data: any) => {
      const booking = history.find(h => h.sessionId === data.sessionId || h.id === data.sessionId);
      if (booking) {
        updateBooking(booking.id, { status: data.status });
        loadBookings();
        toast({
          title: data.status === 'active' ? 'Session Started!' : 'Session Updated',
          description: data.message || 'Your session status has been updated.',
          variant: data.status === 'ended' ? 'destructive' : 'default',
        });
      }
    });

    return () => {
      cleanupOrder();
      cleanupBookingApproved();
      cleanupBooking();
      cleanupSession();
    };
  }, [isConnected, history, emit, joinRoom, on, updateBooking, toast]);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const details = await Promise.all(
        history.map(async (item: BookingHistoryItem) => {
          try {
            if (item.type === 'session' && item.sessionId) {
              const session = await sessionsAPI.getById(item.sessionId);
              return { ...item, details: session };
            } else if (item.type === 'order' && item.orderId) {
              const order = await ordersAPI.getById(item.orderId);
              return { ...item, details: order };
            }
            return item;
          } catch (error) {
            console.error(`Error loading ${item.type} ${item.id}:`, error);
            return item;
          }
        })
      );
      setBookings(details);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (booking: any) => {
    console.log('View Details clicked for booking:', booking);
    
    try {
      // Get the actual ID from booking object (check both item structure and details)
      const sessionId = booking.sessionId || booking.details?.id || booking.id;
      const orderId = booking.orderId || booking.details?.id || booking.id;
      
      // Determine booking type
      const isOrder = booking.type === 'order' || booking.details?.items;
      const isSession = booking.type === 'session' || booking.type === 'activity' || booking.details?.activityId;
      
      if (isOrder && orderId) {
        // Navigate to order confirmation with order details
        const orderData = booking.details || booking;
        console.log('Navigating to order confirmation with:', orderData);
        navigate('/order-confirmation', { state: { order: orderData } });
      } else if (isSession && sessionId) {
        // Check if session is active
        const sessionData = booking.details || booking;
        const isActive = sessionData.status === 'active' || booking.status === 'active';
        
        if (isActive) {
          // For active sessions, navigate to session timer
          console.log('Navigating to session timer with:', sessionData);
          sessionStorage.setItem('currentSession', JSON.stringify(sessionData));
          navigate('/session', { state: { session: sessionData } });
        } else {
          // For inactive/ended sessions, navigate to view booking
          console.log('Navigating to view booking with id:', sessionId);
          navigate(`/view-booking?id=${sessionId}`);
        }
      } else {
        // Fallback: navigate to view booking page
        const bookingId = booking.id || sessionId || orderId;
        console.log('Navigating to view booking (fallback) with id:', bookingId);
        navigate(`/view-booking?id=${bookingId}`);
      }
    } catch (error) {
      console.error('Error in handleViewDetails:', error);
      toast({
        title: 'Error',
        description: 'Unable to view booking details. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'active' || status === 'paid' || status === 'confirmed' || status === 'payment_confirmed' || status === 'preparing' || status === 'ready') {
      return 'text-success';
    }
    if (status === 'completed' || status === 'served') {
      return 'text-primary';
    }
    if (status === 'pending' || status === 'pending_payment' || status === 'pending_approval' || status === 'scheduled') {
      return 'text-warning';
    }
    if (status === 'offline') {
      return 'text-primary'; // Cash payment is valid
    }
    return 'text-destructive';
  };

  const getDisplayStatus = (booking: any): string => {
    // For orders, prioritize order status over payment status
    if (booking.type === 'order' && booking.details) {
      // Order statuses: pending, preparing, ready, served, cancelled
      if (booking.details.status) {
        return booking.details.status;
      }
      // Fallback to payment status only if order status not available
      if (booking.details.paymentStatus === 'offline' || booking.details.paymentStatus === 'paid') {
        return booking.details.paymentStatus === 'offline' ? 'paid' : booking.details.paymentStatus;
      }
    }
    
    // For reservations, check reservation status first
    if (booking.type === 'reservation') {
      if (booking.details?.status) {
        return booking.details.status;
      }
      if (booking.status) {
        return booking.status;
      }
    }
    
    // For sessions/reservations, use status or paymentStatus
    if (booking.details?.status) {
      return booking.details.status;
    }
    if (booking.details?.paymentStatus) {
      // Map payment status to display status
      if (booking.details.paymentStatus === 'offline') {
        return 'paid'; // Show as paid, not offline
      }
      return booking.details.paymentStatus;
    }
    
    // Fallback to booking status
    return booking.status || 'pending';
  };

  const formatStatus = (status: string): string => {
    // Map status to user-friendly display
    const statusMap: Record<string, string> = {
      'pending': 'Pending Payment',
      'pending_payment': 'Pending Payment',
      'pending_approval': 'Pending Approval',
      'payment_confirmed': 'Payment Confirmed',
      'paid': 'Paid',
      'offline': 'Cash Payment',
      'active': 'Active',
      'confirmed': 'Confirmed',
      'preparing': 'Preparing',
      'ready': 'Ready',
      'served': 'Served',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'ended': 'Ended',
      'scheduled': 'Scheduled',
    };
    return statusMap[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="text-muted-foreground">Loading your bookings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-mesh">
      <div className="container max-w-4xl mx-auto px-4 py-6 md:py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header Navbar */}
          <header className="sticky top-0 z-40 glass-ios border-b border-border/50 mb-4 -mx-4 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              {/* Left: Back button + Logo */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/')}
                  className="h-9 w-9"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <Logo size="sm" />
              </div>

              {/* Right: Clear button */}
              <div className="flex items-center flex-shrink-0 w-9">
                {history.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      confirm({
                        title: "Clear History?",
                        description: "Are you sure you want to clear all booking history? This action cannot be undone.",
                        variant: "destructive",
                        confirmText: "Clear",
                        cancelText: "Cancel",
                        onConfirm: () => {
                          clearHistory();
                          setBookings([]);
                          toast({
                            title: 'History Cleared',
                            description: 'All booking history has been cleared.',
                          });
                        },
                      });
                    }}
                    className="h-9 w-9"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                )}
              </div>
            </div>
          </header>

          {/* Page Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
            My Bookings
          </h1>

          {/* Bookings List */}
          {bookings.length > 0 ? (
            <div className="space-y-4">
              {bookings.map((booking, index) => (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="glass cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleViewDetails(booking)}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-1 flex items-center gap-2">
                            {booking.type === 'order' ? (
                              <>
                                {getDisplayStatus(booking) === 'preparing' && <ChefHat className="w-4 h-4" />}
                                {getDisplayStatus(booking) === 'ready' && <Package className="w-4 h-4" />}
                                {getDisplayStatus(booking) === 'served' && <CheckCircle className="w-4 h-4" />}
                                {!['preparing', 'ready', 'served'].includes(getDisplayStatus(booking)) && '🍽️'}
                                Food Order
                              </>
                            ) : (
                              <>
                                🎮 Activity Session
                              </>
                            )}
                          </CardTitle>
                          <CardDescription>
                            {booking.type === 'order' 
                              ? `${booking.details?.items?.length || 0} items`
                              : booking.activityName || booking.details?.activityId?.replace('-', ' ') || 'Activity'}
                          </CardDescription>
                        </div>
                        <div className={`flex items-center gap-2 ${getStatusColor(getDisplayStatus(booking))}`}>
                          {getDisplayStatus(booking) === 'active' || getDisplayStatus(booking) === 'paid' || getDisplayStatus(booking) === 'confirmed' || getDisplayStatus(booking) === 'preparing' || getDisplayStatus(booking) === 'ready' ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : getDisplayStatus(booking) === 'cancelled' || getDisplayStatus(booking) === 'ended' ? (
                            <XCircle className="w-4 h-4" />
                          ) : (
                            <Clock className="w-4 h-4" />
                          )}
                          <span className="text-sm font-medium capitalize">
                            {formatStatus(getDisplayStatus(booking))}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Amount</p>
                          <p className="font-medium text-lg text-primary">
                            {formatCurrency(booking.amount || booking.details?.amount || booking.details?.totalAmount || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Date</p>
                          <p className="font-medium">
                            {new Date(booking.createdAt).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                        {booking.type === 'session' && booking.details?.durationMinutes && (
                          <div>
                            <p className="text-muted-foreground">Duration</p>
                            <p className="font-medium">
                              {formatDuration(booking.details.durationMinutes)}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-muted-foreground">ID</p>
                          <p className="font-mono text-xs break-all">
                            {booking.sessionId || booking.orderId || booking.id}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full mt-4"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(booking);
                        }}
                      >
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card className="glass text-center py-12">
              <p className="text-muted-foreground mb-4">No bookings found</p>
              <p className="text-sm text-muted-foreground mb-6">
                Your booking history will appear here once you make a booking.
              </p>
              <Button onClick={() => navigate('/')}>
                Browse Activities
              </Button>
            </Card>
          )}
        </motion.div>
      </div>
      <ConfirmationDialog />
    </div>
  );
}

