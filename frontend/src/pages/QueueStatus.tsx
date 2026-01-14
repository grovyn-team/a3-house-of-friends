import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Users, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/Logo';
import { queueAPI, reservationsAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/useWebSocket';
import { QueuePromptDialog } from '@/components/QueuePromptDialog';
import { useBookingHistory } from '@/hooks/useBookingHistory';

export default function QueueStatus() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { removeBooking } = useBookingHistory();
  const { on, isConnected, joinRoom, emit } = useWebSocket({ namespace: 'customer' });
  
  const reservationId = location.state?.reservationId;
  const initialPosition = location.state?.queuePosition || 0;
  const activityName = location.state?.activityName || 'Activity';

  const [position, setPosition] = useState(initialPosition);
  const [loading, setLoading] = useState(true);
  const [queuePromptOpen, setQueuePromptOpen] = useState(false);
  const [queuePromptData, setQueuePromptData] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!reservationId) {
      navigate('/');
      return;
    }

    if (isConnected) {
      joinRoom(`reservation:${reservationId}`);
      const storedPhone = sessionStorage.getItem('customerPhone') || localStorage.getItem('customerPhone');
      if (storedPhone) {
        emit('register_customer', { phone: storedPhone });
      }
    }
  }, [reservationId, isConnected, joinRoom, emit, navigate]);

  useEffect(() => {
    if (!isConnected || !reservationId) return;

    const cleanupStatus = on('queue_status', (data: any) => {
      if (data.reservationId === reservationId) {
        setPosition(data.position);
        toast({
          title: 'Queue Update',
          description: data.message,
        });
      }
    });

    const cleanupResource = on('queue_resource_available', (data: any) => {
      if (data.reservationId === reservationId) {
        setQueuePromptData(data);
        setQueuePromptOpen(true);
      }
    });

    return () => {
      cleanupStatus();
      cleanupResource();
    };
  }, [isConnected, reservationId, on, toast]);

  useEffect(() => {
    const loadQueueStatus = async () => {
      if (!reservationId) return;
      
      try {
        const status = await queueAPI.getQueueStatus(reservationId);
        if (status) {
          setPosition(status.position);
        }
      } catch (error) {
        console.error('Failed to load queue status:', error);
      } finally {
        setLoading(false);
      }
    };

    loadQueueStatus();
  }, [reservationId]);

  const handlePay = async () => {
    if (!queuePromptData || !reservationId) return;

    setProcessing(true);
    try {
      const reservation = await reservationsAPI.getById(reservationId);
      
      navigate('/payment', {
        state: {
          reservationId,
          amount: queuePromptData.amount,
          activity: {
            id: queuePromptData.activityId,
            name: queuePromptData.activityName,
          },
          bookingRequest: {
            activityId: queuePromptData.activityId,
            unitId: queuePromptData.unitId,
            duration: queuePromptData.duration,
            customerName: reservation.customerName,
            customerPhone: reservation.customerPhone,
            qrContext: reservation.qrContext || {},
          },
          fromQueue: true,
        },
      });
      setQueuePromptOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to proceed to payment',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleExit = async () => {
    if (!reservationId) return;

    setProcessing(true);
    try {
      await reservationsAPI.exitQueue(reservationId);
      
      removeBooking(reservationId);
      sessionStorage.removeItem('currentSession');
      sessionStorage.removeItem('customerPhone');
      localStorage.removeItem('customerPhone');
      
      toast({
        title: 'Exited Queue',
        description: 'You have successfully exited the waiting queue.',
      });

      navigate('/');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to exit queue',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen gradient-mesh">
      <div className="container max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-foreground">
              Queue Status
            </h1>
            <p className="text-sm text-muted-foreground">
              {activityName}
            </p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-center">Your Position</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              {loading ? (
                <div className="text-muted-foreground">Loading...</div>
              ) : (
                <>
                  <div className="text-6xl font-bold text-primary mb-2">
                    #{position}
                  </div>
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>in the waiting queue</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>Estimated wait: {Math.ceil(position * 0.5)} min</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>What happens next?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• You'll be notified when a system becomes available</p>
              <p>• You can proceed to payment or exit the queue</p>
              <p>• Your position updates in real-time</p>
            </CardContent>
          </Card>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleExit}
            disabled={processing}
          >
            Exit Queue
          </Button>
        </motion.div>
      </div>

      {queuePromptData && (
        <QueuePromptDialog
          open={queuePromptOpen}
          onOpenChange={setQueuePromptOpen}
          onPay={handlePay}
          onExit={handleExit}
          activityName={queuePromptData.activityName}
          unitName={queuePromptData.unitName}
          amount={queuePromptData.amount}
          duration={queuePromptData.duration}
          loading={processing}
        />
      )}
    </div>
  );
}
