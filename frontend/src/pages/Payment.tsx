import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CreditCard, Smartphone, Wallet, CheckCircle, XCircle, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
  const duration = bookingRequest?.duration || session?.durationMinutes || session?.duration;

  const [paymentMode, setPaymentMode] = useState<'online' | 'cash' | null>(null);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<'online' | 'cash' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'wallet' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');

  useEffect(() => {
    const finalAmount = amount || session?.finalAmount || session?.amount;
    if ((!sessionId && !orderId && !reservationId) || !finalAmount) {
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
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (!isConnected || !customerPhone) return;

    const normalizedPhone = customerPhone.replace(/\D/g, '');
    if (normalizedPhone.length >= 10) {
      emit('register_customer', { phone: normalizedPhone });
    }

    if (reservationId) {
      joinRoom(`reservation:${reservationId}`);
    }
    if (orderId) {
      joinRoom(`order:${orderId}`);
    }
    if (sessionId) {
      joinRoom(`session:${sessionId}`);
    }

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
        if (response.requiresApproval) {
          addBooking({
            id: reservationId,
            type: 'reservation',
            customerName: customerName || 'Customer',
            customerPhone: customerPhone || '',
            amount: amount || 0,
            status: 'pending_approval',
            createdAt: new Date().toISOString(),
            reservationId: reservationId,
            activityId: activity?.type || activity?.id,
            durationMinutes: duration || 0,
          });
          
          toast({
            title: 'Payment Recorded',
            description: 'Your cash payment has been recorded. Waiting for admin approval to assign system.',
          });
          setTimeout(() => {
            navigate('/my-bookings');
          }, 2000);
          return;
        }
        if (response.sessionId) {
          const session = await sessionsAPI.getById(response.sessionId);
          
          updateBooking(reservationId, {
            sessionId: response.sessionId,
            status: 'active',
          });

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
        name: 'A3 House of Friends',
        description,
        handler: async (response: any) => {
          try {
            // Verify payment
            const verifyResult = await paymentsAPI.verify({
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
              // Check if user was added to queue (from verifyResult)
              if (verifyResult.queued) {
                // User was added to waiting queue
                addBooking({
                  id: reservationId,
                  type: 'reservation',
                  customerName: customerName || 'Customer',
                  customerPhone: customerPhone || '',
                  amount: amount || 0,
                  status: 'payment_confirmed', // Payment successful but waiting for system
                  createdAt: new Date().toISOString(),
                  reservationId: reservationId,
                  activityId: activity?.type || activity?.id,
                  durationMinutes: duration || 0,
                });
                
                toast({
                  title: 'Payment Successful',
                  description: 'You have been added to the waiting queue. We will notify you when a system becomes available.',
                });
                setTimeout(() => {
                  navigate('/my-bookings');
                }, 1500);
                return;
              }
              
              // Unit is available, session should be started
              // Try to get session from verifyResult or confirm reservation
              let session;
              if (verifyResult.sessionId) {
                session = await sessionsAPI.getById(verifyResult.sessionId);
              } else {
                // Fallback: confirm reservation
                const result = await reservationsAPI.confirm(reservationId, response.razorpay_payment_id);
                session = await sessionsAPI.getById(result.sessionId);
              }
              
              // Update booking in history
              addBooking({
                id: reservationId,
                type: 'reservation',
                customerName: customerName || 'Customer',
                customerPhone: customerPhone || '',
                amount: amount || session.finalAmount || session.amount || 0,
                status: 'active',
                createdAt: new Date().toISOString(),
                reservationId: reservationId,
                sessionId: session.id,
                activityId: activity?.type || activity?.id,
                durationMinutes: duration || 0,
              });
              
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
        {paymentStatus === 'idle' && !selectedPaymentMode && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Select Payment Mode
            </h2>

            <Button
              variant={paymentMode === 'cash' ? 'default' : 'outline'}
              size="lg"
              className="w-full justify-start h-auto py-4 glass"
              onClick={() => setPaymentMode('cash')}
              disabled={isProcessing}
            >
              <Banknote className="w-5 h-5 mr-3" />
              <div className="flex-1 text-left">
                <div className="font-medium">Cash Payment</div>
                <div className="text-xs text-muted-foreground">
                  Pay at the counter
                </div>
              </div>
              {paymentMode === 'cash' && (
                <CheckCircle className="w-5 h-5 ml-auto" />
              )}
            </Button>

            <Button
              variant={paymentMode === 'online' ? 'default' : 'outline'}
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
              {paymentMode === 'online' && (
                <CheckCircle className="w-5 h-5 ml-auto" />
              )}
            </Button>

            {/* Continue Button - Only show when payment mode is selected */}
            {paymentMode && (
              <Button
                size="lg"
                className="w-full mt-6"
                onClick={() => {
                  if (paymentMode === 'cash') {
                    setSelectedPaymentMode('cash');
                  } else {
                    setSelectedPaymentMode('online');
                  }
                }}
                disabled={isProcessing}
              >
                Continue
              </Button>
            )}
          </div>
        )}

        {/* Cash Payment Confirmation */}
        {paymentStatus === 'idle' && selectedPaymentMode === 'cash' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedPaymentMode(null);
                  setPaymentMode(null);
                }}
              >
                ← Back
              </Button>
              <h2 className="text-lg font-semibold text-foreground">
                Confirm Cash Payment
              </h2>
            </div>

            <Card className="glass border-primary/20">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Banknote className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Cash Payment Selected</p>
                      <p className="text-sm text-muted-foreground">
                        You will pay at the counter after admin approval
                      </p>
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-2">
                      After confirmation, your booking will be added to the admin queue with pending approval status. 
                      The admin will assign a system and start your session timer once approved.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              size="lg"
              className="w-full mt-4"
              onClick={handleCashPayment}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Confirm Cash Payment'}
            </Button>
          </div>
        )}

        {/* Online Payment Methods */}
        {paymentStatus === 'idle' && selectedPaymentMode === 'online' && !paymentMethod && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedPaymentMode(null);
                  setPaymentMode(null);
                }}
              >
                ← Back
              </Button>
              <h2 className="text-lg font-semibold text-foreground">
                Select Payment Method
              </h2>
            </div>

            <Button
              variant={paymentMethod === 'upi' ? 'default' : 'outline'}
              size="lg"
              className="w-full justify-start h-auto py-4 glass"
              onClick={() => setPaymentMethod('upi')}
              disabled={isProcessing}
            >
              <Smartphone className="w-5 h-5 mr-3" />
              <div className="flex-1 text-left">
                <div className="font-medium">UPI</div>
                <div className="text-xs text-muted-foreground">
                  Pay via UPI apps (GPay, PhonePe, Paytm)
                </div>
              </div>
              {paymentMethod === 'upi' && (
                <CheckCircle className="w-5 h-5 ml-auto" />
              )}
            </Button>

            <Button
              variant={paymentMethod === 'card' ? 'default' : 'outline'}
              size="lg"
              className="w-full justify-start h-auto py-4 glass"
              onClick={() => setPaymentMethod('card')}
              disabled={isProcessing}
            >
              <CreditCard className="w-5 h-5 mr-3" />
              <div className="flex-1 text-left">
                <div className="font-medium">Credit/Debit Card</div>
                <div className="text-xs text-muted-foreground">
                  Visa, Mastercard, RuPay
                </div>
              </div>
              {paymentMethod === 'card' && (
                <CheckCircle className="w-5 h-5 ml-auto" />
              )}
            </Button>

            <Button
              variant={paymentMethod === 'wallet' ? 'default' : 'outline'}
              size="lg"
              className="w-full justify-start h-auto py-4 glass"
              onClick={() => setPaymentMethod('wallet')}
              disabled={isProcessing}
            >
              <Wallet className="w-5 h-5 mr-3" />
              <div className="flex-1 text-left">
                <div className="font-medium">Wallet</div>
                <div className="text-xs text-muted-foreground">
                  Paytm, Amazon Pay, etc.
                </div>
              </div>
              {paymentMethod === 'wallet' && (
                <CheckCircle className="w-5 h-5 ml-auto" />
              )}
            </Button>

            {/* Proceed to Payment Button - Only show when payment method is selected */}
            {paymentMethod && (
              <Button
                size="lg"
                className="w-full mt-6"
                onClick={() => handleOnlinePayment(paymentMethod)}
                disabled={isProcessing}
              >
                Proceed to Payment
              </Button>
            )}
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

