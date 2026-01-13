import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, User, Phone, Receipt, Calendar, CheckCircle, XCircle, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/Logo';
import { sessionsAPI, ordersAPI, reservationsAPI } from '@/lib/api';
import { formatCurrency, formatDuration } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useBookingHistory } from '@/hooks/useBookingHistory';

export default function ViewBooking() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { getBooking } = useBookingHistory();
  
  const bookingId = searchParams.get('id');
  const [inputId, setInputId] = useState(bookingId || '');
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<'session' | 'order' | 'reservation' | null>(null);

  useEffect(() => {
    if (bookingId) {
      handleSearch(bookingId);
    }
  }, [bookingId]);

  const handleSearch = async (id?: string) => {
    const searchId = id || inputId.trim();
    if (!searchId) {
      toast({
        title: 'Missing ID',
        description: 'Please enter a booking or order ID.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const localBooking = getBooking(searchId);
      if (localBooking) {
        setBooking(localBooking);
        setType(localBooking.type === 'reservation' ? 'reservation' : localBooking.type);
        setLoading(false);
        return;
      }

      let found = false;
      try {
        const reservation = await reservationsAPI.getById(searchId);
        setBooking(reservation);
        setType('reservation');
        found = true;
      } catch (reservationError) {
        try {
          const session = await sessionsAPI.getById(searchId);
          setBooking(session);
          setType('session');
          found = true;
        } catch (sessionError) {
          try {
            const order = await ordersAPI.getById(searchId);
            setBooking(order);
            setType('order');
            found = true;
          } catch (orderError) {
            // All failed
            throw new Error('Booking, reservation, or order not found');
          }
        }
      }
    } catch (error: any) {
      toast({
        title: 'Not Found',
        description: error.message || 'Could not find booking, reservation, or order with this ID.',
        variant: 'destructive',
      });
      setBooking(null);
      setType(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  const getStatusColor = (status: string) => {
    if (status === 'active' || status === 'paid' || status === 'confirmed' || status === 'payment_confirmed') {
      return 'text-success';
    }
    if (status === 'completed' || status === 'served') {
      return 'text-primary';
    }
    if (status === 'pending' || status === 'scheduled' || status === 'pending_approval' || status === 'pending_payment') {
      return 'text-warning';
    }
    return 'text-destructive';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'active' || status === 'paid' || status === 'confirmed' || status === 'completed' || status === 'payment_confirmed') {
      return <CheckCircle className="w-4 h-4" />;
    }
    if (status === 'pending_approval' || status === 'pending_payment' || status === 'pending' || status === 'scheduled') {
      return <Loader className="w-4 h-4 animate-spin" />;
    }
    return <XCircle className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen gradient-mesh">
      <div className="container max-w-2xl mx-auto px-4 py-6 md:py-10">
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

              {/* Right: Page Title */}
              <div className="flex items-center flex-shrink-0">
                <h2 className="text-base md:text-lg font-semibold text-foreground">
                  View Booking
                </h2>
              </div>
            </div>
          </header>

          {/* Search Form */}
          <Card className="glass">
            <CardHeader>
              <CardTitle>Enter Booking or Order ID</CardTitle>
              <CardDescription>
                Enter your booking ID or order ID to view details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  placeholder="Enter booking/order ID"
                  value={inputId}
                  onChange={(e) => setInputId(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader className="w-4 h-4 animate-spin" /> : 'Search'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Booking Details */}
          {booking && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="glass-strong">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>
                      {type === 'session' ? 'Session Details' : type === 'reservation' ? 'Reservation Details' : 'Order Details'}
                    </CardTitle>
                    <div className={`flex items-center gap-2 ${getStatusColor(booking.status || booking.paymentStatus)}`}>
                      {getStatusIcon(booking.status || booking.paymentStatus)}
                      <span className="text-sm font-medium capitalize">
                        {(booking.status || booking.paymentStatus || 'pending').replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Customer Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Customer Name</p>
                        <p className="font-medium">{booking.customerName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{booking.customerPhone}</p>
                      </div>
                    </div>
                  </div>

                  {/* Session/Reservation Details */}
                  {(type === 'session' || type === 'reservation') && (
                    <>
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Activity</p>
                          <p className="font-medium">
                            {booking.activityName 
                              || booking.activityId?.name
                              || (booking.activityId?.type ? booking.activityId.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) : null)
                              || (typeof booking.activityId === 'string' ? booking.activityId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) : null)
                              || 'N/A'}
                          </p>
                        </div>
                      </div>
                      {booking.unitName && (
                        <div className="flex items-center gap-3">
                          <Calendar className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Unit</p>
                            <p className="font-medium">{booking.unitName}</p>
                          </div>
                        </div>
                      )}
                      {booking.startTime && (
                        <div className="flex items-center gap-3">
                          <Clock className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Start Time</p>
                            <p className="font-medium">
                              {new Date(booking.startTime).toLocaleString('en-IN')}
                            </p>
                          </div>
                        </div>
                      )}
                      {booking.endTime && (
                        <div className="flex items-center gap-3">
                          <Clock className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">End Time</p>
                            <p className="font-medium">
                              {new Date(booking.endTime).toLocaleString('en-IN')}
                            </p>
                          </div>
                        </div>
                      )}
                      {(booking.durationMinutes || booking.duration) && (
                        <div className="flex items-center gap-3">
                          <Clock className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Duration</p>
                            <p className="font-medium">
                              {formatDuration(booking.durationMinutes || booking.duration)}
                            </p>
                          </div>
                        </div>
                      )}
                      {type === 'reservation' && booking.status === 'pending_approval' && (
                        <div className="rounded-lg bg-warning/10 border border-warning/20 p-4">
                          <p className="text-sm text-warning font-medium">
                            ⏳ Waiting for admin approval. Your session will start once approved.
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Order Details */}
                  {type === 'order' && booking.items && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Items</p>
                      <div className="space-y-2">
                        {booking.items.map((item: any, index: number) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{item.name || `Item ${index + 1}`} x {item.quantity}</span>
                            <span className="font-medium">
                              {formatCurrency((item.price || 0) * (item.quantity || 1))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Amount */}
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Receipt className="w-5 h-5 text-muted-foreground" />
                        <span className="text-lg font-bold">Total Amount</span>
                      </div>
                      <span className="text-2xl font-bold text-primary">
                        {formatCurrency(booking.amount || booking.totalAmount || booking.baseAmount || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  {type === 'session' && booking.status === 'active' && (
                    <Button
                      variant="glow"
                      className="w-full"
                      onClick={() => {
                        sessionStorage.setItem('currentSession', JSON.stringify(booking));
                        navigate('/session', { state: { session: booking } });
                      }}
                    >
                      View Live Timer
                    </Button>
                  )}

                  {type === 'order' && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        navigate('/order-confirmation', { state: { order: booking } });
                      }}
                    >
                      View Order Details
                    </Button>
                  )}
                  {type === 'reservation' && booking.status === 'pending_approval' && (
                    <div className="rounded-lg bg-warning/10 border border-warning/20 p-4 text-center">
                      <p className="text-sm text-warning font-medium">
                        ⏳ Waiting for admin approval. Your session will start once approved.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* No Results */}
          {!booking && !loading && inputId && (
            <Card className="glass text-center py-8">
              <p className="text-muted-foreground">No booking or order found with this ID.</p>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}

