import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Users, ArrowRight, Sparkles, History, Search, Gamepad2, Car, CircleDot, UtensilsCrossed } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { activitiesAPI, sessionsAPI } from '@/lib/api';
import { ActivityType, QRContext } from '@/lib/types';
import { getQRContext } from '@/lib/qr-context';
import { formatCurrency, formatDuration } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ACTIVITIES, calculateActivityPrice, isPeakHour } from '@/lib/constants';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useBookingHistory } from '@/hooks/useBookingHistory';
import { ChallengeForm, ChallengeFormData } from '@/components/ChallengeForm';

export default function Landing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { history } = useBookingHistory();
  const [qrContext, setQrContext] = useState<QRContext>({});
  const [activities, setActivities] = useState<any[]>(ACTIVITIES.filter(a => a.enabled));
  const [loading, setLoading] = useState(true);
  const [challengeDialogOpen, setChallengeDialogOpen] = useState(false);
  const [challengeLoading, setChallengeLoading] = useState(false);

  // WebSocket for real-time availability updates - connect immediately on page load
  const { on, joinRoom, isConnected, emit } = useWebSocket({ namespace: 'customer' });

  // Emit visitor connection when WebSocket connects
  useEffect(() => {
    if (isConnected && emit) {
      emit('visitor_connected', {
        qrContext,
        timestamp: new Date().toISOString(),
      });
    }
  }, [isConnected, emit, qrContext]);

  useEffect(() => {
    const context = getQRContext();
    setQrContext(context);
    loadActivities();
  }, [searchParams]);

  // Listen for availability changes
  useEffect(() => {
    if (!isConnected) return;

    // Join activity rooms silently (for real-time updates, but don't log)
    activities.forEach(activity => {
      // Only join if we have activities loaded
      if (activity.id) {
        joinRoom(`activity:${activity.id}`);
      }
    });

    const cleanupAvailability = on('availability_changed', (data: { activity_id: string; status: string }) => {
      setActivities(prev => prev.map(activity => {
        if (activity.id === data.activity_id || activity._id === data.activity_id) {
          // Update availability status
          return {
            ...activity,
            units: activity.units?.map((unit: any) => ({
              ...unit,
              status: data.status === 'occupied' ? 'occupied' : 'available',
            })),
          };
        }
        return activity;
      }));
    });

    // Listen for booking status updates
    const cleanupBooking = on('booking_status_update', (data: any) => {
      toast({
        title: data.status === 'confirmed' ? 'Booking Confirmed!' : 
               data.status === 'cancelled' ? 'Booking Cancelled' : 'Booking Updated',
        description: data.message || 'Your booking status has been updated.',
        variant: data.status === 'cancelled' ? 'destructive' : 'default',
      });
    });

    // Listen for order status updates
    const cleanupOrder = on('order_status_update', (data: any) => {
      toast({
        title: data.status === 'preparing' ? 'Order Being Prepared!' :
               data.status === 'ready' ? 'Order Ready!' :
               data.status === 'served' ? 'Order Served!' :
               data.status === 'cancelled' ? 'Order Cancelled' : 'Order Updated',
        description: data.message || 'Your order status has been updated.',
        variant: data.status === 'cancelled' ? 'destructive' : 'default',
      });
    });

    // Listen for session status updates
    const cleanupSession = on('session_status_update', (data: any) => {
      toast({
        title: data.status === 'active' ? 'Session Started!' : 
               data.status === 'ended' ? 'Session Ended' : 'Session Updated',
        description: data.message || 'Your session status has been updated.',
        variant: data.status === 'ended' ? 'destructive' : 'default',
      });
    });

    return () => {
      cleanupAvailability();
      cleanupBooking();
      cleanupOrder();
      cleanupSession();
    };
  }, [isConnected, activities, on, joinRoom, toast]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const data = await activitiesAPI.getAll(true);
      if (data && data.length > 0) {
        setActivities(data);
      }
    } catch (error: any) {
      console.error('Failed to load activities from API, using local data:', error);
      setActivities(ACTIVITIES.filter(a => a.enabled));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectActivity = (activityId: string) => {
    navigate(`/book?activity=${activityId}`, {
      state: { qrContext },
    });
  };

  const handleChallengeSubmit = async (data: ChallengeFormData) => {
    try {
      setChallengeLoading(true);
      
      // Get first player's phone from QR context or use a default
      const firstPlayerPhone = data.players[0]?.phone || '';
      
      // Create challenge session
      const session = await sessionsAPI.createChallenge({
        players: data.players,
        activityId: data.activityId,
        activityType: data.activityType,
        duration: data.duration,
        qrContext,
        customerName: data.players[0].name,
        customerPhone: firstPlayerPhone || '0000000000',
      });

      toast({
        title: 'Challenge Started!',
        description: 'Your challenge session has been created. Let the games begin!',
      });

      // Navigate to session timer
      sessionStorage.setItem('currentSession', JSON.stringify(session));
      setChallengeDialogOpen(false);
      navigate('/session', { state: { session } });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start challenge session',
        variant: 'destructive',
      });
    } finally {
      setChallengeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="text-muted-foreground">Loading activities...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-mesh">
      <div className="container max-w-lg mx-auto px-4 py-6 md:py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 md:space-y-8"
        >
          {/* Header */}
          <header className="text-center space-y-3">
            <Logo size="lg" className="justify-center" />
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 glow-primary">
              <Sparkles className="w-4 h-4 text-primary neon-flicker" />
              <span className="text-sm font-medium text-primary neon-text">Skip the wait, join online</span>
            </div>
            
            {/* Quick Actions */}
            <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
              <Button
                variant="glow"
                size="sm"
                onClick={() => setChallengeDialogOpen(true)}
                className="glass border-primary/30"
              >
                <Users className="w-4 h-4 mr-2" />
                 Loose to pay
              </Button>
              {history.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/my-bookings')}
                  className="glass"
                >
                  <History className="w-4 h-4 mr-2" />
                  My Bookings ({history.length})
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/view-booking')}
                className="glass"
              >
                <Search className="w-4 h-4 mr-2" />
                View Booking
              </Button>
            </div>
          </header>

          {/* Welcome Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-3xl p-5 md:p-6 text-center"
          >
            <span className="text-4xl md:text-5xl mb-3 block">👋</span>
            <h2 className="text-xl md:text-2xl font-display font-bold text-foreground mb-2">
              Welcome!
            </h2>
            <p className="text-muted-foreground text-sm md:text-base">
              Select an activity to book your session. No more waiting around!
            </p>
          </motion.div>

          {/* Activities Grid */}
          {activities.length > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-4"
            >
              {activities.map((activity, index) => {
                const availableUnits = activity.units?.filter((u: any) => u.status === 'available').length || 0;
                const totalUnits = activity.units?.length || 0;
                const peak = isPeakHour();
                const samplePrice = calculateActivityPrice(activity, activity.minimumDuration, peak);

                // Get icon component based on activity type
                const getActivityIcon = (type: string) => {
                  const iconClass = "h-8 w-8 text-primary";
                  const typeLower = type.toLowerCase();
                  if (typeLower.includes('snooker')) {
                    return <CircleDot className={iconClass} />;
                  } else if (typeLower.includes('playstation')) {
                    return <Gamepad2 className={iconClass} />;
                  } else if (typeLower.includes('racing')) {
                    return <Car className={iconClass} />;
                  } else {
                    return <CircleDot className={iconClass} />;
                  }
                };

                return (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                  >
                    <Card
                      className="cursor-pointer hover:border-primary/50 hover:shadow-neon-cyan transition-all glass group"
                      onClick={() => handleSelectActivity(activity.id)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="flex items-center justify-center">
                              {getActivityIcon(activity.id)}
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-lg md:text-xl mb-1">
                                {activity.name}
                              </CardTitle>
                              <CardDescription className="text-sm">
                                {activity.description}
                              </CardDescription>
                            </div>
                          </div>
                          <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0 ml-4" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            <span>
                              {availableUnits} of {totalUnits} available
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            <span>Min: {formatDuration(activity.minimumDuration)}</span>
                          </div>
                          <div className="ml-auto text-right">
                            <span className="font-medium text-foreground block">
                              From {formatCurrency(samplePrice)}
                            </span>
                            {peak && activity.peakMultiplier && (
                              <span className="text-xs text-muted-foreground">
                                Peak pricing
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center py-12"
            >
              <p className="text-muted-foreground">No activities available at the moment.</p>
            </motion.div>
          )}

          {/* Food Ordering Option */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + activities.length * 0.1 + 0.1 }}
            className="mt-6"
          >
            <Card
              className="cursor-pointer hover:border-primary/50 hover:shadow-neon-cyan transition-all glass group"
              onClick={() => navigate('/menu', { state: { qrContext } })}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UtensilsCrossed className="h-8 w-8 text-primary" />
                    <div>
                      <CardTitle className="text-lg">Order Food & Beverages</CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Browse our menu and place an order
                      </CardDescription>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardHeader>
            </Card>
          </motion.div>
        </motion.div>
      </div>

      {/* Challenge Form Dialog */}
      <ChallengeForm
        open={challengeDialogOpen}
        onOpenChange={setChallengeDialogOpen}
        onSubmit={handleChallengeSubmit}
        loading={challengeLoading}
      />
    </div>
  );
}
