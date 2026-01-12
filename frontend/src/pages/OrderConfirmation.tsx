import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Home, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function OrderConfirmation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const order = location.state?.order as any;
  const { on, joinRoom, isConnected, emit } = useWebSocket({ namespace: 'customer' });

  useEffect(() => {
    if (!order) {
      navigate('/');
    }
  }, [order, navigate]);

  // Register customer and listen for order status updates
  useEffect(() => {
    if (!isConnected || !order) return;

    // Register customer phone
    if (order.customerPhone) {
      const normalizedPhone = order.customerPhone.replace(/\D/g, '');
      emit('register_customer', { phone: normalizedPhone });
    }

    // Join order room
    if (order.id) {
      joinRoom(`order:${order.id}`);
    }

    // Listen for order status updates
    const cleanupOrder = on('order_status_update', (data: any) => {
      if (data.orderId === order.id) {
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

    return () => {
      cleanupOrder();
    };
  }, [isConnected, order, emit, joinRoom, on, toast]);

  if (!order) {
    return null;
  }

  return (
    <div className="min-h-screen gradient-mesh flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="glass-strong border-2">
            <CardContent className="pt-12 pb-12">
              <div className="text-center space-y-6">
                <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-10 h-10 text-success" />
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Order Confirmed!
                  </h2>
                  <p className="text-muted-foreground">
                    Your order has been placed successfully
                  </p>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Order ID</span>
                    <span className="font-medium text-foreground">
                      #{order.id.slice(-8).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Amount</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(order.totalAmount)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1 glass"
                    onClick={() => navigate('/receipt', { state: { order } })}
                  >
                    <Receipt className="w-4 h-4 mr-2" />
                    View Receipt
                  </Button>
                  <Button
                    variant="glow"
                    className="flex-1"
                    onClick={() => navigate('/')}
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Home
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

