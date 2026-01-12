import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CreditCard, Smartphone, Wallet, CheckCircle, XCircle, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Logo } from '@/components/Logo';
import { paymentsAPI, sessionsAPI, ordersAPI, reservationsAPI } from '@/lib/api';
import { formatCurrency, QRContext } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useBookingHistory } from '@/hooks/useBookingHistory';
import { useWebSocket } from '@/hooks/useWebSocket';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaymentProps {
  orderId?: string;
  amount?: number;
  customerName?: string;
  customerPhone?: string;
  qrContext?: QRContext;
  sessionId?: string;
  reservationId?: string;
}

export default function Payment(props?: PaymentProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { addBooking, updateBooking } = useBookingHistory();
  const { emit, on, joinRoom, isConnected } = useWebSocket({ namespace: 'customer' });

  // Support both component props and location state
  const sessionId = props?.sessionId || location.state?.sessionId as string | undefined;
  const orderId = props?.orderId || location.state?.orderId as string | undefined;
  const reservationId = props?.reservationId || location.state?.reservationId as string | undefined;
  const amount = props?.amount || location.state?.amount as number | undefined;
  const activity = location.state?.activity as any;
  const bookingRequest = location.state?.bookingRequest as any;
  const session = location.state?.session as any;
  const isChallengeSession = location.state?.isChallengeSession as boolean | undefined;
  const challengeWinner = location.state?.winner as string | undefined;
  const customerName = props?.customerName || bookingRequest?.customerName || session?.customerName;
  const customerPhone = props?.customerPhone || bookingRequest?.customerPhone || session?.customerPhone;
  const qrContext = props?.qrContext || location.state?.qrContext as QRContext | undefined;

  const [paymentMode, setPaymentMode] = useState<'online' | 'cash' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'wallet' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');

  useEffect(() => {
    // For challenge sessions, amount might come from session object
    const finalAmount = amount || session?.finalAmount || session?.amount;
    if ((!sessionId && !orderId && !reservationId) || !finalAmount) {
      // Allow challenge sessions without explicit amount (it comes from session)
      if (!isChallengeSession) {
        toast({
          title: 'Invalid Request',
          description: 'Please start your booking from the beginning.',
          variant: 'destructive',
        });
        navigate('/');
      }
    }
  }, [sessionId, orderId, reservationId, amount, session, isChallengeSession, navigate, toast]);

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Register customer and listen for status updates
  useEffect(() => {
    if (!isConnected || !customerPhone) return;

    // Register customer phone
    const normalizedPhone = customerPhone.replace(/\D/g, '');
    if (normalizedPhone.length >= 10) {
      emit('register_customer', { phone: normalizedPhone });
    }

    // Join relevant rooms
    if (reservationId) {
      joinRoom(`reservation:${reservationId}`);
    }
    if (orderId) {
      joinRoom(`order:${orderId}`);
    }
    if (sessionId) {
      joinRoom(`session:${sessionId}`);
    }

    // Listen for booking status updates
    const cleanupBooking = on('booking_status_update', (data: any) => {
      if ((reservationId && data.reservationId === reservationId) || 
          (sessionId && data.sessionId === sessionId)) {
        toast({
          title: data.status === 'confirmed' ? 'Booking Confirmed!' : 'Booking Updated',
          description: data.message || 'Your booking status has been updated.',
          variant: data.status === 'cancelled' ? 'destructive' : 'default',
        });
      }
    });

    // Listen for order status updates
    const cleanupOrder = on('order_status_update', (data: any) => {
      if (orderId && data.orderId === orderId) {
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

    // Listen for session status updates
    const cleanupSession = on('session_status_update', (data: any) => {
      if (sessionId && (data.sessionId === sessionId || data.session_id === sessionId)) {
        toast({
          title: data.status === 'active' ? 'Session Started!' : 'Session Updated',
          description: data.message || 'Your session status has been updated.',
          variant: data.status === 'ended' ? 'destructive' : 'default',
        });
      }
    });

    return () => {
      cleanupBooking();
      cleanupOrder();
      cleanupSession();
    };
  }, [isConnected, customerPhone, reservationId, orderId, sessionId, emit, joinRoom, on, toast]);

  // Get final amount from session if it's a challenge session
  const finalAmount = amount || session?.finalAmount || session?.amount;
  
  if ((!sessionId && !orderId && !reservationId) || (!finalAmount && !isChallengeSession)) {
    return null;
  }

  const paymentType = orderId ? 'order' : (reservationId ? 'reservation' : 'session');
  const entityId = orderId || reservationId || sessionId!;
  const description = isChallengeSession 
    ? `Challenge Session - ${challengeWinner || 'Winner'} pays for all`
    : (orderId ? 'Food Order' : (activity?.name || 'Activity Booking'));

  const handleCashPayment = async () => {
    setPaymentMode('cash');
    setIsProcessing(true);
    setPaymentStatus('processing');

    try {
      const response = await paymentsAPI.markOffline({
        type: paymentType,
        entityId,
      });

      setPaymentStatus('success');

      if (orderId) {
        const order = await ordersAPI.getById(orderId);
        
        // Track order in history
        addBooking({
          id: orderId,
          type: 'order',
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          amount: order.totalAmount || order.amount,
          status: order.paymentStatus || 'paid',
          createdAt: order.createdAt || new Date().toISOString(),
          orderId: orderId,
        });

        // Emit payment event to admin
        emit('payment_completed', {
          type: 'order',
          orderId,
          amount: order.totalAmount || order.amount,
          paymentMethod: 'offline',
          timestamp: new Date().toISOString(),
        });

        toast({
          title: 'Payment Confirmed',
          description: 'Your order has been confirmed. Please pay at the counter.',
        });
        setTimeout(() => {
          navigate('/order-confirmation', {
            state: { order },
          });
        }, 1500);
      } else if (reservationId) {
        // markOfflinePayment already confirms reservation and creates session
        // Get session from response
        if (response.sessionId) {
          const session = await sessionsAPI.getById(response.sessionId);
          
          // Update booking in history
          updateBooking(reservationId, {
            sessionId: response.sessionId,
            status: 'active',
          });

          // Emit payment event to admin
          emit('payment_completed', {
            type: 'reservation',
            reservationId,
            sessionId: response.sessionId,
            amount: amount || session.baseAmount || session.amount,
            paymentMethod: 'offline',
            timestamp: new Date().toISOString(),
          });

          toast({
            title: 'Payment Confirmed',
            description: 'Your session has started. Please pay at the counter.',
          });
          sessionStorage.setItem('currentSession', JSON.stringify(session));
          setTimeout(() => {
            navigate('/session', {
              state: { session },
            });
          }, 1500);
        } else {
          // Fallback: try to confirm manually if sessionId not in response
          const result = await reservationsAPI.confirm(reservationId, 'offline');
          const session = await sessionsAPI.getById(result.sessionId);
          toast({
            title: 'Payment Confirmed',
            description: 'Your session has started. Please pay at the counter.',
          });
          sessionStorage.setItem('currentSession', JSON.stringify(session));
          setTimeout(() => {
            navigate('/session', {
              state: { session },
            });
          }, 1500);
        }
      } else if (sessionId) {
        const session = await sessionsAPI.getById(sessionId);
        toast({
          title: 'Payment Confirmed',
          description: 'Your session has started. Please pay at the counter.',
        });
        sessionStorage.setItem('currentSession', JSON.stringify(session));
        setTimeout(() => {
          navigate('/session', {
            state: { session },
          });
        }, 1500);
      }
    } catch (error: any) {
      setPaymentStatus('failed');
      setIsProcessing(false);
      toast({
        title: 'Payment Error',
        description: error.message || 'An error occurred. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleOnlinePayment = async (method: 'upi' | 'card' | 'wallet') => {
    setPaymentMode('online');
    setPaymentMethod(method);
    setPaymentMethod(method);
    setIsProcessing(true);
    setPaymentStatus('processing');

    try {
      // Create Razorpay order
      const paymentOrder = await paymentsAPI.createOrder({
        amount: finalAmount || amount || 0,
        type: paymentType,
        entityId,
        customerName: customerName || 'Customer',
        customerPhone: customerPhone || '',
      });

      // Initialize Razorpay
      if (!window.Razorpay) {
        throw new Error('Razorpay SDK not loaded');
      }

      const options = {
        key: paymentOrder.keyId,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        order_id: paymentOrder.orderId,
        name: 'a3houseoffriends',
        description,
        handler: async (response: any) => {
          try {
            // Verify payment
            await paymentsAPI.verify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              type: paymentType,
              entityId,
            });

            setPaymentStatus('success');

            if (orderId) {
              // Get updated order
              const order = await ordersAPI.getById(orderId);
              toast({
                title: 'Payment Successful',
                description: 'Your order has been confirmed.',
              });
              setTimeout(() => {
                navigate('/order-confirmation', {
                  state: { order },
                });
              }, 1500);
            } else if (reservationId) {
              // Confirm reservation and get session
              const result = await reservationsAPI.confirm(reservationId, response.razorpay_payment_id);
              const session = await sessionsAPI.getById(result.sessionId);
              toast({
                title: 'Payment Successful',
                description: 'Your session has started.',
              });
              sessionStorage.setItem('currentSession', JSON.stringify(session));
              setTimeout(() => {
                navigate('/session', {
                  state: { session },
                });
              }, 1500);
            } else if (sessionId) {
              // Get updated session
              const sessionData = await sessionsAPI.getById(sessionId);
              
              toast({
                title: 'Payment Successful',
                description: isChallengeSession && challengeWinner
                  ? `${challengeWinner} has paid for everyone's session.`
                  : 'Your session has started.',
              });
              
              // Store session and navigate
              sessionStorage.setItem('currentSession', JSON.stringify(sessionData));
              setTimeout(() => {
                navigate('/session', {
                  state: { session: sessionData },
                });
              }, 1500);
            }
          } catch (error: any) {
            setPaymentStatus('failed');
            toast({
              title: 'Payment Verification Failed',
              description: error.message || 'Please contact support.',
              variant: 'destructive',
            });
            setIsProcessing(false);
          }
        },
        prefill: {
          name: customerName || '',
          contact: customerPhone || '',
        },
        theme: {
          color: '#0EA5E9',
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            setPaymentStatus('idle');
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      setPaymentStatus('failed');
      setIsProcessing(false);
      toast({
        title: 'Payment Error',
        description: error.message || 'An error occurred. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen gradient-mesh">
      <div className="container max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            disabled={isProcessing}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-foreground">
              Complete Payment
            </h1>
            <p className="text-sm text-muted-foreground">
              Choose your payment method
            </p>
          </div>
        </div>

        {/* Payment Status */}
        {paymentStatus === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6"
          >
            <Card className="glass border-success">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-success" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">
                      Payment Successful
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Your session is starting...
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {paymentStatus === 'failed' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6"
          >
            <Card className="glass border-destructive">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                    <XCircle className="w-8 h-8 text-destructive" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">
                      Payment Failed
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Please try again with a different method
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Order Summary */}
        <Card className="glass mb-6">
          <CardHeader>
            <CardTitle className="text-lg">
              {isChallengeSession ? 'Challenge Session Summary' : 'Booking Summary'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isChallengeSession && session?.challengeData && (
              <>
                <div className="rounded-lg bg-accent/10 border border-accent/20 p-3 mb-3">
                  <p className="text-xs font-medium text-foreground mb-2">Challenge Session</p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>Players: {session.challengeData.players?.map((p: any) => p.name).join(', ')}</p>
                    {challengeWinner && (
                      <p className="text-success font-medium mt-2">
                        Winner: {challengeWinner} (Paying for all {session.challengeData.totalPlayers} players)
                      </p>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}
            {activity && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Activity</span>
                  <span className="text-foreground">{activity.name || session?.activityId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="text-foreground">{session?.duration || bookingRequest?.duration} minutes</span>
                </div>
                {isChallengeSession && session?.challengeData && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Number of Players</span>
                    <span className="text-foreground">{session.challengeData.totalPlayers}</span>
                  </div>
                )}
                <Separator />
              </>
            )}
            {orderId && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order Type</span>
                  <span className="text-foreground">Food Order</span>
                </div>
                <Separator />
              </>
            )}
            <div className="flex justify-between text-lg font-semibold">
              <span>{isChallengeSession ? 'Total Amount (All Players)' : 'Total Amount'}</span>
              <span>{formatCurrency(finalAmount || amount || session?.finalAmount || session?.amount || 0)}</span>
            </div>
            {isChallengeSession && challengeWinner && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                {challengeWinner} is paying for everyone's session
              </p>
            )}
          </CardContent>
        </Card>

        {/* Payment Mode Selection */}
        {paymentStatus === 'idle' && !paymentMode && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Select Payment Mode
            </h2>

            <Button
              variant="outline"
              size="lg"
              className="w-full justify-start h-auto py-4 glass"
              onClick={handleCashPayment}
              disabled={isProcessing}
            >
              <Banknote className="w-5 h-5 mr-3" />
              <div className="flex-1 text-left">
                <div className="font-medium">Cash Payment</div>
                <div className="text-xs text-muted-foreground">
                  Pay at the counter
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full justify-start h-auto py-4 glass"
              onClick={() => setPaymentMode('online')}
              disabled={isProcessing}
            >
              <CreditCard className="w-5 h-5 mr-3" />
              <div className="flex-1 text-left">
                <div className="font-medium">Online Payment</div>
                <div className="text-xs text-muted-foreground">
                  Pay via UPI, Card, or Wallet
                </div>
              </div>
            </Button>
          </div>
        )}

        {/* Online Payment Methods */}
        {paymentStatus === 'idle' && paymentMode === 'online' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPaymentMode(null)}
              >
                ← Back
              </Button>
              <h2 className="text-lg font-semibold text-foreground">
                Select Payment Method
              </h2>
            </div>

            <Button
              variant="outline"
              size="lg"
              className="w-full justify-start h-auto py-4 glass"
              onClick={() => handleOnlinePayment('upi')}
              disabled={isProcessing}
            >
              <Smartphone className="w-5 h-5 mr-3" />
              <div className="flex-1 text-left">
                <div className="font-medium">UPI</div>
                <div className="text-xs text-muted-foreground">
                  Pay via UPI apps (GPay, PhonePe, Paytm)
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full justify-start h-auto py-4 glass"
              onClick={() => handleOnlinePayment('card')}
              disabled={isProcessing}
            >
              <CreditCard className="w-5 h-5 mr-3" />
              <div className="flex-1 text-left">
                <div className="font-medium">Credit/Debit Card</div>
                <div className="text-xs text-muted-foreground">
                  Visa, Mastercard, RuPay
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full justify-start h-auto py-4 glass"
              onClick={() => handleOnlinePayment('wallet')}
              disabled={isProcessing}
            >
              <Wallet className="w-5 h-5 mr-3" />
              <div className="flex-1 text-left">
                <div className="font-medium">Wallet</div>
                <div className="text-xs text-muted-foreground">
                  Paytm, Amazon Pay, etc.
                </div>
              </div>
            </Button>
          </div>
        )}

        {isProcessing && paymentStatus === 'processing' && (
          <div className="text-center py-8">
            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">
              Processing payment...
            </p>
          </div>
        )}

        {/* Security Note */}
        {paymentMode === 'online' && (
          <div className="mt-8 text-center">
            <p className="text-xs text-muted-foreground">
              🔒 Your payment is secured by Razorpay
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

